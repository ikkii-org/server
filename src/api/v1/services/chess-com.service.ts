/**
 * Chess.com PubAPI Integration Service
 *
 * Endpoints used:
 *  - GET /player/{username}           → Player profile
 *  - GET /player/{username}/stats     → Ratings & records
 *  - GET /player/{username}/games/{YYYY}/{MM} → Monthly game archive
 *
 * Note: Chess.com requires a recognizable User-Agent header.
 *       No API key is required for the read-only PubAPI.
 */

import { env } from "../../../config/env";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChessComPlayer {
  player_id: number;
  username: string;
  name?: string;
  title?: string;
  status: string;
  avatar?: string;
  country: string;
  joined: number;
  last_online: number;
  followers: number;
  is_streamer?: boolean;
  twitch_url?: string;
  fide?: number;
}

export interface ChessComGameTypeStats {
  last: {
    rating: number;
    date: number;
    rd: number;
  };
  best?: {
    rating: number;
    date: number;
    game: string;
  };
  record: {
    win: number;
    loss: number;
    draw: number;
    time_per_move?: number;
    timeout_percent?: number;
  };
  tournament?: {
    count: number;
    withdraw: number;
    points: number;
    highest_finish: number;
  };
}

export interface ChessComStats {
  chess_daily?: ChessComGameTypeStats;
  chess960_daily?: ChessComGameTypeStats;
  chess_rapid?: ChessComGameTypeStats;
  chess_blitz?: ChessComGameTypeStats;
  chess_bullet?: ChessComGameTypeStats;
  fide?: number;
  tactics?: {
    highest: { rating: number; date: number };
    lowest: { rating: number; date: number };
  };
  lessons?: {
    highest: { rating: number; date: number };
    lowest: { rating: number; date: number };
  };
  puzzle_rush?: {
    daily?: { total_attempts: number; score: number };
    best?: { total_attempts: number; score: number };
  };
}

export interface ChessComGame {
  url: string;
  pgn: string;
  time_control: string;
  time_class: string;
  rules: string;
  white: {
    username: string;
    rating: number;
    result: string;
    "@id": string;
  };
  black: {
    username: string;
    rating: number;
    result: string;
    "@id": string;
  };
  end_time: number;
  rated: boolean;
  accuracies?: {
    white: number;
    black: number;
  };
  fen?: string;
  start_time?: number;
  eco?: string;
  tournament?: string;
  match?: string;
}

export interface ChessComMonthlyArchive {
  games: ChessComGame[];
}

export interface ChessComMatchVerification {
  verified: boolean;
  winner: string | null;
  reason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Normalize Chess.com username for API URLs.
 * Usernames are case-insensitive in the API.
 */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

/**
 * Build the User-Agent header required by Chess.com.
 */
function getUserAgent(): string {
  return (
    env.CHESS_COM_USER_AGENT ??
    "ikki/1.0 (+https://ikkii.gg; contact@ikkii.gg)"
  );
}

/**
 * Generic fetch helper for Chess.com PubAPI endpoints.
 */
async function fetchChessCom<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": getUserAgent(),
      },
    });

    if (response.status === 404) {
      return null; // Player or data not found
    }

    if (response.status === 429) {
      console.warn("Chess.com rate limit hit:", url);
      return null;
    }

    if (!response.ok) {
      console.error(
        `Chess.com API error: ${response.status} for ${url}`
      );
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    console.error(`Chess.com fetch failed for ${url}:`, err);
    return null;
  }
}

// ─── API Calls ────────────────────────────────────────────────────────────────

/**
 * Fetch player profile from Chess.com.
 */
export async function getPlayer(
  baseUrl: string,
  username: string
): Promise<ChessComPlayer | null> {
  const url = `${baseUrl}/player/${normalizeUsername(username)}`;
  return fetchChessCom<ChessComPlayer>(url);
}

/**
 * Fetch player stats (ratings, records, best ratings).
 */
export async function getPlayerStats(
  baseUrl: string,
  username: string
): Promise<ChessComStats | null> {
  const url = `${baseUrl}/player/${normalizeUsername(username)}/stats`;
  return fetchChessCom<ChessComStats>(url);
}

/**
 * Fetch monthly game archive for a player.
 */
export async function getMonthlyArchive(
  baseUrl: string,
  username: string,
  year: number,
  month: number
): Promise<ChessComMonthlyArchive | null> {
  const mm = String(month).padStart(2, "0");
  const url = `${baseUrl}/player/${normalizeUsername(username)}/games/${year}/${mm}`;
  return fetchChessCom<ChessComMonthlyArchive>(url);
}

// ─── Match Verification ───────────────────────────────────────────────────────

/**
 * Verify if two Chess.com players played against each other recently.
 *
 * Checks the current month's archive for games between the two players.
 * If none found in the current month, falls back to the previous month.
 *
 * @param withinMinutes - Time window to look back (default: 24 hours)
 * @returns verified, winner (username), and reason
 */
export async function verifyMatchBetweenPlayers(
  baseUrl: string,
  username1: string,
  username2: string,
  withinMinutes: number = 60
): Promise<ChessComMatchVerification> {
  const u1 = normalizeUsername(username1);
  const u2 = normalizeUsername(username2);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Try current month first
  let archive = await getMonthlyArchive(baseUrl, u1, year, month);

  // Fallback to previous month if empty or not found
  if (!archive || archive.games.length === 0) {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    archive = await getMonthlyArchive(baseUrl, u1, prevYear, prevMonth);
  }

  if (!archive || archive.games.length === 0) {
    return {
      verified: false,
      winner: null,
      reason: "No games found in recent months",
    };
  }

  // Filter games against the opponent within the time window
  const cutoffSeconds = Math.floor(
    (Date.now() - withinMinutes * 60 * 1000) / 1000
  );

  const matches = archive.games.filter((game) => {
    const opponent =
      game.white.username.toLowerCase() === u1
        ? game.black.username.toLowerCase()
        : game.white.username.toLowerCase();

    return opponent === u2 && game.end_time >= cutoffSeconds;
  });

  if (matches.length === 0) {
    return {
      verified: false,
      winner: null,
      reason: `No match found between ${u1} and ${u2} within ${withinMinutes} minutes`,
    };
  }

  // Take the most recent match
  const match = matches[matches.length - 1];
  const winner = determineWinner(match, u1, u2);

  if (!winner) {
    return {
      verified: true,
      winner: null,
      reason: "Match verified but ended in a draw",
    };
  }

  return {
    verified: true,
    winner,
    reason: `Match verified — ${winner} won`,
  };
}

/**
 * Determine the winner of a Chess.com game.
 * Returns the winning username, or null for draws.
 */
function determineWinner(
  game: ChessComGame,
  username1: string,
  username2: string
): string | null {
  const whiteResult = game.white.result;
  const blackResult = game.black.result;

  // "win" means that side won
  if (whiteResult === "win") {
    return game.white.username.toLowerCase() === username1.toLowerCase()
      ? username1
      : username2;
  }

  if (blackResult === "win") {
    return game.black.username.toLowerCase() === username1.toLowerCase()
      ? username1
      : username2;
  }

  // Everything else is a draw or loss condition that doesn't produce a winner
  return null;
}

// ─── Stats Formatting ─────────────────────────────────────────────────────────

/**
 * Format a player's current ratings into a rank string.
 * Example: "Blitz: 1500 | Rapid: 1600"
 */
export function formatRank(stats: ChessComStats): string {
  const parts: string[] = [];

  if (stats.chess_blitz?.last) {
    parts.push(`Blitz: ${stats.chess_blitz.last.rating}`);
  }
  if (stats.chess_rapid?.last) {
    parts.push(`Rapid: ${stats.chess_rapid.last.rating}`);
  }
  if (stats.chess_bullet?.last) {
    parts.push(`Bullet: ${stats.chess_bullet.last.rating}`);
  }
  if (stats.chess_daily?.last) {
    parts.push(`Daily: ${stats.chess_daily.last.rating}`);
  }

  return parts.join(" | ") || "Unrated";
}

/**
 * Build the stats JSONB object for storage.
 */
export function buildStatsJson(stats: ChessComStats): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const extractFormat = (
    key: string,
    data?: ChessComGameTypeStats
  ) => {
    if (!data) return;
    result[key] = {
      rating: data.last?.rating,
      best: data.best?.rating,
      record: data.record,
    };
  };

  extractFormat("blitz", stats.chess_blitz);
  extractFormat("rapid", stats.chess_rapid);
  extractFormat("bullet", stats.chess_bullet);
  extractFormat("daily", stats.chess_daily);
  extractFormat("chess960", stats.chess960_daily);

  if (stats.fide) {
    result.fide = stats.fide;
  }

  return result;
}
