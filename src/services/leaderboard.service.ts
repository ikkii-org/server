import { db } from "../db";
import { users, portfolio } from "../db/schema";
import { eq, desc, sql } from "drizzle-orm";

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
 * Returns players ranked by wins descending, then totalStakeWon descending.
 * Supports offset-based pagination via `limit` and `offset`.
 */
export async function getLeaderboard(limit = 50, offset = 0): Promise<LeaderboardEntry[]> {
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
        .limit(limit)
        .offset(offset);

    return rows.map((row, idx) => {
        const totalGames = row.wins + row.losses;
        const winPercentage =
            totalGames > 0
                ? Math.round((row.wins / totalGames) * 10000) / 100
                : 0;

        return {
            rank: offset + idx + 1,
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
 * Returns the leaderboard position and stats for a single user using a SQL
 * window function — O(log n) instead of O(n).
 */
export async function getPlayerRank(username: string): Promise<LeaderboardEntry | null> {
    const result = await db.execute<{
        user_id: string;
        username: string;
        pfp: string | null;
        wins: number;
        losses: number;
        total_won: number;
        total_lost: number;
        current_rank: number;
        previous_rank: number;
        rank: string;
    }>(sql`
        SELECT
            u.user_id,
            u.username,
            u.pfp,
            u.wins,
            u.losses,
            p.total_won,
            p.total_lost,
            p.current_rank,
            p.previous_rank,
            RANK() OVER (ORDER BY u.wins DESC, p.total_won DESC) AS rank
        FROM users u
        INNER JOIN portfolio p ON p.user_id = u.user_id
        WHERE u.username = ${username}
    `);

    const row = result.rows[0];
    if (!row) return null;

    const totalGames = row.wins + row.losses;
    const winPercentage =
        totalGames > 0 ? Math.round((row.wins / totalGames) * 10000) / 100 : 0;

    return {
        rank: parseInt(row.rank, 10),
        userId: row.user_id,
        username: row.username,
        pfp: row.pfp ?? null,
        wins: row.wins,
        losses: row.losses,
        winPercentage,
        totalStakeWon: row.total_won,
        totalStakeLost: row.total_lost,
        currentRank: row.current_rank,
        previousRank: row.previous_rank,
    };
}

/**
 * Recalculate and persist `currentRank` / `previousRank` for all users
 * using a single bulk UPDATE with a window-function CTE.
 * Should be called periodically (e.g. a scheduled job).
 */
export async function refreshRanks(): Promise<void> {
    await db.execute(sql`
        WITH ranked AS (
            SELECT
                p.user_id,
                p.current_rank AS old_rank,
                RANK() OVER (ORDER BY u.wins DESC, p.total_won DESC)::int AS new_rank
            FROM portfolio p
            INNER JOIN users u ON u.user_id = p.user_id
        )
        UPDATE portfolio p
        SET
            previous_rank = r.old_rank,
            current_rank  = r.new_rank,
            updated_at    = NOW()
        FROM ranked r
        WHERE p.user_id = r.user_id
    `);
}

