import { db } from "../db";
import { users, portfolio } from "../db/schema";
import { eq, desc, asc } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    pfp: string | null;
    wins: number;
    losses: number;
    winPercentage: number;
    totalStakeWon: number;
    totalStakeLost: number;
    currentRank: number;
    previousRank: number;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Returns the top `limit` players ranked by wins descending, then totalStakeWon descending.
 */
export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
    const rows = await db
        .select({
            userId: users.id,
            username: users.username,
            pfp: users.pfp,
            wins: users.wins,
            losses: users.losses,
            totalStakeWon: portfolio.totalStakeWon,
            totalStakeLost: portfolio.totalStakeLost,
            currentRank: portfolio.currentRank,
            previousRank: portfolio.previousRank,
        })
        .from(users)
        .innerJoin(portfolio, eq(portfolio.userId, users.id))
        .orderBy(desc(users.wins), desc(portfolio.totalStakeWon))
        .limit(limit);

    return rows.map((row, idx) => {
        const totalGames = row.wins + row.losses;
        const winPercentage =
            totalGames > 0
                ? Math.round((row.wins / totalGames) * 10000) / 100
                : 0;

        return {
            rank: idx + 1,
            userId: row.userId,
            username: row.username,
            pfp: row.pfp ?? null,
            wins: row.wins,
            losses: row.losses,
            winPercentage,
            totalStakeWon: row.totalStakeWon,
            totalStakeLost: row.totalStakeLost,
            currentRank: row.currentRank,
            previousRank: row.previousRank,
        };
    });
}

/**
 * Returns the leaderboard position and stats for a single user.
 * Returns null if the user has no portfolio row.
 */
export async function getPlayerRank(username: string): Promise<LeaderboardEntry | null> {
    const board = await getLeaderboard(1000);
    return board.find((e) => e.username === username) ?? null;
}

/**
 * Recalculate and persist `currentRank` / `previousRank` for all users.
 * Should be called periodically (e.g. a scheduled job).
 */
export async function refreshRanks(): Promise<void> {
    const board = await getLeaderboard(10_000);

    await Promise.all(
        board.map((entry) =>
            db
                .update(portfolio)
                .set({
                    previousRank: entry.currentRank,
                    currentRank: entry.rank,
                    updatedAt: new Date(),
                })
                .where(eq(portfolio.userId, entry.userId))
        )
    );
}
