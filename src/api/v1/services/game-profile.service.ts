/**
 * Game Profile Service
 *
 * Handles linking external game accounts and syncing stats.
 */

import { db } from "../../../db";
import { games, gameProfiles, users } from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getPlayer as getClashRoyalePlayer, type ClashRoyalePlayer } from "./clash-royale.service";
import { env } from "../../../config/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GameProfileData {
  id: string;
  userId: string;
  gameId: string;
  gameName: string;
  playerId: string | null;
  rank: string | null;
  stats: Record<string, unknown> | null;
}

export interface SyncResult {
  success: boolean;
  profile: GameProfileData | null;
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getGameByName(gameName: string) {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.name, gameName));
  return game ?? null;
}

// ─── Link Game Account ────────────────────────────────────────────────────────

/**
 * Link a user's external game account (e.g., Clash Royale player tag).
 * Creates a new game profile or updates an existing one.
 *
 * For supported games (Clash Royale), validates the player tag against
 * the game's API before saving — rejects invalid/non-existent tags.
 */
export async function linkGameAccount(
  userId: string,
  gameName: string,
  playerId: string,
  claimedWins?: number,
  claimedChallengeMaxWins?: number,
): Promise<SyncResult> {
  // 1. Find the game
  const game = await getGameByName(gameName);
  if (!game) {
    return { success: false, profile: null, error: `Game '${gameName}' not found` };
  }

  // 2. Validate the player ID against the game's API (includes ownership check for CR)
  const validation = await validatePlayerId(gameName, playerId, game, claimedWins, claimedChallengeMaxWins);
  if (!validation.valid) {
    return { success: false, profile: null, error: validation.error! };
  }

  // Use the canonical tag from the API (e.g. uppercased, with "#" prefix)
  const canonicalPlayerId = validation.canonicalId ?? playerId;
  const initialRank = validation.rank ?? null;
  const initialStats = validation.stats ?? null;

  // 3. Check if profile already exists
  const [existing] = await db
    .select()
    .from(gameProfiles)
    .where(
      and(
        eq(gameProfiles.userId, userId),
        eq(gameProfiles.gameId, game.id)
      )
    );

  if (existing) {
    // Update playerId + stats from the validation fetch
    const [updated] = await db
      .update(gameProfiles)
      .set({ playerId: canonicalPlayerId, rank: initialRank ?? existing.rank, stats: initialStats ?? existing.stats })
      .where(eq(gameProfiles.id, existing.id))
      .returning();

    return {
      success: true,
      profile: {
        id: updated.id,
        userId: updated.userId,
        gameId: updated.gameId,
        gameName: game.name,
        playerId: updated.playerId,
        rank: updated.rank,
        stats: updated.stats,
      },
    };
  }

  // 4. Create new profile with validated data
  const [created] = await db
    .insert(gameProfiles)
    .values({
      userId,
      gameId: game.id,
      playerId: canonicalPlayerId,
      rank: initialRank,
      stats: initialStats,
    })
    .returning();

  return {
    success: true,
    profile: {
      id: created.id,
      userId: created.userId,
      gameId: created.gameId,
      gameName: game.name,
      playerId: created.playerId,
      rank: created.rank,
      stats: created.stats,
    },
  };
}

// ─── Player ID Validation ─────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Canonical player ID from the API (e.g. "#2YQ8JCRUG") */
  canonicalId?: string;
  /** Initial rank pulled during validation */
  rank?: string;
  /** Initial stats pulled during validation */
  stats?: Record<string, unknown>;
}

// ─── Ownership Verification ───────────────────────────────────────────────────

const WINS_TOLERANCE = 5;

/**
 * Extended CR player type that includes stat fields present in the live API
 * response but not yet in the base ClashRoyalePlayer interface.
 */
type ClashRoyalePlayerFull = ClashRoyalePlayer & {
  wins: number;
  losses: number;
  challengeMaxWins: number;
};

/**
 * Two-question ownership check against live CR API data:
 *  1. Career wins — verified with ±WINS_TOLERANCE (accounts for games played mid-verification)
 *  2. Challenge max wins — exact match (a personal best, never decreases mid-session)
 *
 * Returns null on success, an error string on failure.
 */
function verifyClashRoyaleOwnership(
  player: ClashRoyalePlayerFull,
  claimedWins: number | undefined,
  claimedChallengeMaxWins: number | undefined,
): string | null {
  // Both fields must be provided
  if (claimedWins === undefined || claimedChallengeMaxWins === undefined) {
    return (
      "To verify this is your account, please provide: " +
      "(1) your career wins count (visible on your profile stats page) and " +
      "(2) your all-time challenge max wins (Settings → Stats → Challenge)."
    );
  }

  // Check 1: career wins within tolerance
  const winsDiff = Math.abs(player.wins - claimedWins);
  if (winsDiff > WINS_TOLERANCE) {
    return (
      `Career wins mismatch — your account has ${player.wins} wins, but you submitted ${claimedWins}. ` +
      `Check your profile stats page and try again.`
    );
  }

  // Check 2: challenge max wins — exact
  if (player.challengeMaxWins !== claimedChallengeMaxWins) {
    return (
      `Challenge max wins mismatch — submitted ${claimedChallengeMaxWins}, but your account shows ${player.challengeMaxWins}. ` +
      `Find this under Settings → Stats → Challenge in-game.`
    );
  }

  return null;
}

/**
 * Validate a player ID against the game's external API.
 * Returns the canonical ID and initial stats on success.
 */
async function validatePlayerId(
  gameName: string,
  playerId: string,
  game: typeof games.$inferSelect,
  claimedWins?: number,
  claimedChallengeMaxWins?: number,
): Promise<ValidationResult> {
  if (gameName.toLowerCase() === "clash royale") {
    return await validateClashRoyaleTag(playerId, game, claimedWins, claimedChallengeMaxWins);
  }

  // Games without API validation — accept any player ID
  return { valid: true };
}

/**
 * Validate a Clash Royale player tag by fetching the player profile,
 * then verify ownership via the two-question check.
 * Normalizes the tag (adds "#" prefix if missing, uppercases).
 */
async function validateClashRoyaleTag(
  rawTag: string,
  game: typeof games.$inferSelect,
  claimedWins?: number,
  claimedChallengeMaxWins?: number,
): Promise<ValidationResult> {
  // Normalize: ensure "#" prefix, uppercase
  let tag = rawTag.trim().toUpperCase();
  if (!tag.startsWith("#")) {
    tag = `#${tag}`;
  }

  if (!env.CLASH_ROYALE_TOKEN) {
    return { valid: false, error: "Clash Royale API key not configured on server" };
  }

  if (!game.apiBaseUrl) {
    return { valid: false, error: "Clash Royale API URL not configured" };
  }

  const player = await getClashRoyalePlayer(game.apiBaseUrl, env.CLASH_ROYALE_TOKEN, tag);

  if (!player) {
    return {
      valid: false,
      error: `Player tag "${tag}" not found on Clash Royale. Make sure you entered the correct tag (e.g. #2YQ8JCRUG).`,
    };
  }

  // ── Ownership verification ──────────────────────────────────────────────────
  const ownershipError = verifyClashRoyaleOwnership(
    player as ClashRoyalePlayerFull,
    claimedWins,
    claimedChallengeMaxWins,
  );
  if (ownershipError) {
    return { valid: false, error: ownershipError };
  }

  return {
    valid: true,
    canonicalId: player.tag,
    rank: player.arena.name,
    stats: {
      trophies: player.trophies,
      bestTrophies: player.bestTrophies,
      expLevel: player.expLevel,
      clan: player.clan?.name ?? null,
    },
  };
}

// ─── Sync Game Profile ────────────────────────────────────────────────────────

/**
 * Fetch latest stats from the game's API and update the profile.
 */
export async function syncGameProfile(
  userId: string,
  gameName: string
): Promise<SyncResult> {
  // 1. Find game and profile
  const game = await getGameByName(gameName);
  if (!game) {
    return { success: false, profile: null, error: `Game '${gameName}' not found` };
  }

  const [profile] = await db
    .select()
    .from(gameProfiles)
    .where(
      and(
        eq(gameProfiles.userId, userId),
        eq(gameProfiles.gameId, game.id)
      )
    );

  if (!profile) {
    return { success: false, profile: null, error: "Game profile not linked" };
  }

  if (!profile.playerId) {
    return { success: false, profile: null, error: "Player ID not set" };
  }

  if (!game.apiBaseUrl) {
    return { success: false, profile: null, error: "Game API not configured" };
  }

  // 2. Game-specific sync
  if (gameName.toLowerCase() === "clash royale") {
    return await syncClashRoyaleProfile(profile, game);
  }

  return { success: false, profile: null, error: `No sync support for ${gameName}` };
}

// ─── Clash Royale Sync ────────────────────────────────────────────────────────

async function syncClashRoyaleProfile(
  profile: typeof gameProfiles.$inferSelect,
  game: typeof games.$inferSelect
): Promise<SyncResult> {
  if (!env.CLASH_ROYALE_TOKEN) {
    return { success: false, profile: null, error: "Clash Royale token not configured" };
  }

  const playerData = await getClashRoyalePlayer(
    game.apiBaseUrl!,
    env.CLASH_ROYALE_TOKEN,
    profile.playerId!
  );

  if (!playerData) {
    return { success: false, profile: null, error: "Failed to fetch Clash Royale data" };
  }

  // Update profile with latest stats
  const [updated] = await db
    .update(gameProfiles)
    .set({
      rank: playerData.arena.name,
      stats: {
        trophies: playerData.trophies,
        bestTrophies: playerData.bestTrophies,
        expLevel: playerData.expLevel,
        clan: playerData.clan?.name ?? null,
      },
    })
    .where(eq(gameProfiles.id, profile.id))
    .returning();

  return {
    success: true,
    profile: {
      id: updated.id,
      userId: updated.userId,
      gameId: updated.gameId,
      gameName: game.name,
      playerId: updated.playerId,
      rank: updated.rank,
      stats: updated.stats,
    },
  };
}

// ─── Get User's Game Profiles ─────────────────────────────────────────────────

/**
 * Get all game profiles for a user.
 */
export async function getUserGameProfiles(userId: string): Promise<GameProfileData[]> {
  const profiles = await db
    .select({
      id: gameProfiles.id,
      userId: gameProfiles.userId,
      gameId: gameProfiles.gameId,
      gameName: games.name,
      playerId: gameProfiles.playerId,
      rank: gameProfiles.rank,
      stats: gameProfiles.stats,
    })
    .from(gameProfiles)
    .innerJoin(games, eq(gameProfiles.gameId, games.id))
    .where(eq(gameProfiles.userId, userId));

  return profiles;
}

/**
 * Get a specific game profile for a user.
 */
export async function getGameProfile(
  userId: string,
  gameName: string
): Promise<GameProfileData | null> {
  const game = await getGameByName(gameName);
  if (!game) return null;

  const [profile] = await db
    .select({
      id: gameProfiles.id,
      userId: gameProfiles.userId,
      gameId: gameProfiles.gameId,
      gameName: games.name,
      playerId: gameProfiles.playerId,
      rank: gameProfiles.rank,
      stats: gameProfiles.stats,
    })
    .from(gameProfiles)
    .innerJoin(games, eq(gameProfiles.gameId, games.id))
    .where(
      and(
        eq(gameProfiles.userId, userId),
        eq(gameProfiles.gameId, game.id)
      )
    );

  return profile ?? null;
}
