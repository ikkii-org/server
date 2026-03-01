import { db } from "../../../db";
import { users, portfolio } from "../../../db/schema";
import { eq, sql } from "drizzle-orm";
import type { User } from "../../../db/schema";
import type { PlayerProfile } from "../models/user.model";

export type { PlayerProfile };

// ─── Lookups ──────────────────────────────────────────────────────────────────

export async function getPlayer(username: string): Promise<User> {
    const [player] = await db.select().from(users).where(eq(users.username, username));
    if (!player) throw new Error("Player not found");
    return player;
}

export async function getPlayerById(userId: string): Promise<User> {
    const [player] = await db.select().from(users).where(eq(users.id, userId));
    if (!player) throw new Error("Player not found");
    return player;
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export async function getPlayerProfile(username: string): Promise<PlayerProfile> {
    const player = await getPlayer(username);
    const [port] = await db.select().from(portfolio).where(eq(portfolio.userId, player.id));

    const total = player.wins + player.losses;
    const winPercentage = total > 0 ? Math.round((player.wins / total) * 10000) / 100 : 0;

    return {
        userId: player.id,
        username: player.username,
        pfp: player.pfp ?? null,
        wins: player.wins,
        losses: player.losses,
        winPercentage,
        portfolio: port
            ? {
                solanaBalance: port.solanaBalance,
                currentRank: port.currentRank,
                previousRank: port.previousRank,
                totalStakeWon: port.totalStakeWon,
                totalStakeLost: port.totalStakeLost,
            }
            : null,
    };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updatePlayerPfp(username: string, pfp: string): Promise<User> {
    const [player] = await db
        .update(users)
        .set({ pfp, updatedAt: new Date() })
        .where(eq(users.username, username))
        .returning();

    if (!player) throw new Error("Player not found");
    return player;
}

export async function recordWin(userId: string, stakeAmount: number): Promise<void> {
    await db.update(users).set({ wins: sql`${users.wins} + 1`, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.update(portfolio).set({ totalStakeWon: sql`${portfolio.totalStakeWon} + ${stakeAmount}`, updatedAt: new Date() }).where(eq(portfolio.userId, userId));
}

export async function recordLoss(userId: string, stakeAmount: number): Promise<void> {
    await db.update(users).set({ losses: sql`${users.losses} + 1`, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.update(portfolio).set({ totalStakeLost: sql`${portfolio.totalStakeLost} + ${stakeAmount}`, updatedAt: new Date() }).where(eq(portfolio.userId, userId));
}
