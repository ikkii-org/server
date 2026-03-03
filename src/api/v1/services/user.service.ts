import { db } from "../../../db";
import { users, portfolio } from "../../../db/schema";
import { eq, sql } from "drizzle-orm";
import type { User } from "../../../db/schema";
import type { PlayerProfile, UserStatic, UserStats } from "../models/user.model";
import { get, setWithTTL, del, CACHE_KEYS, TTL } from "./cache.service";

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
    // Step 1: Build cache keys
    const staticKey = CACHE_KEYS.USER_STATIC(username);
    const statsKey = CACHE_KEYS.USER_STATS(username);

    // Step 2: Check both caches
    const [cachedStatic, cachedStats] = await Promise.all([
        get<UserStatic>(staticKey),
        get<UserStats>(statsKey),
    ]);

    // Step 3: If both hit, merge and return
    if (cachedStatic !== null && cachedStats !== null) {
        console.log(`[User] Cache HIT for ${username} (static + stats)`);
        return { ...cachedStatic, ...cachedStats };
    }
    console.log(`[User] Cache MISS for ${username}`);

    // Step 4: Cache miss - query database
    const player = await getPlayer(username);
    const [port] = await db.select().from(portfolio).where(eq(portfolio.userId, player.id));

    const total = player.wins + player.losses;
    const winPercentage = total > 0 ? Math.round((player.wins / total) * 10000) / 100 : 0;

    // Step 5: Build cache objects
    const staticData: UserStatic = {
        userId: player.id,
        username: player.username,
        pfp: player.pfp ?? null,
    };

    const statsData: UserStats = {
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

    // Step 6: Cache both with different TTLs
    await Promise.all([
        setWithTTL(staticKey, staticData, TTL.USER_STATIC),
        setWithTTL(statsKey, statsData, TTL.USER_STATS),
    ]);
    console.log(`[User] Cached ${username} - static (${TTL.USER_STATIC}s), stats (${TTL.USER_STATS}s)`);

    return { ...staticData, ...statsData };
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
