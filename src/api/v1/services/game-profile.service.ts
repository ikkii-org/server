/**
 * Game Profile Service
 *
 * Handles linking external game accounts and syncing stats.
 */

import { db } from "../../../db";
import { games, gameProfiles, users } from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { getPlayer as getClashRoyalePlayer } from "./clash-royale.service";

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
 */
export async function linkGameAccount(
  userId: string,
  gameName: string,
  playerId: string
): Promise<SyncResult> {
  // 1. Find the game
  const game = await getGameByName(gameName);
  if (!game) {
    return { success: false, profile: null, error: `Game '${gameName}' not found` };
  }

  // 2. Check if profile already exists
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
    // Update playerId
    const [updated] = await db
      .update(gameProfiles)
      .set({ playerId })
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

  // 3. Create new profile
  const [created] = await db
    .insert(gameProfiles)
    .values({
      userId,
      gameId: game.id,
      playerId,
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

  if (!game.apiBaseUrl || !game.apiKey) {
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
  const playerData = await getClashRoyalePlayer(
    game.apiBaseUrl!,
    game.apiKey!,
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
