import { PlayerProfile } from "../models/user.model";
import { db } from "../db";
import { users, User } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export async function createPlayer(
    username: string,
    walletKey: string,
    pfp?: string
): Promise<User> {
    if (!username) {
        throw new Error("Username is required");
    }
    if (!walletKey) {
        throw new Error("Wallet key is required");
    }

    const [player] = await db
        .insert(users)
        .values({
            username,
            walletKey,
            pfp: pfp || null,
        })
        .returning();

    return player;
}

export async function getPlayer(username: string): Promise<User> {
    const [player] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));

    if (!player) {
        throw new Error("Player not found");
    }
    return player;
}

export async function getPlayerProfile(username: string): Promise<PlayerProfile> {
    const player = await getPlayer(username);
    
    const totalGames = player.wins + player.losses;
    const winPercentage = totalGames > 0 ? (player.wins / totalGames) * 100 : 0;

    return {
        username: player.username,
        pfp: player.pfp,
        wins: player.wins,
        losses: player.losses,
        totalWon: player.totalWon,
        totalLost: player.totalLost,
        winPercentage: Math.round(winPercentage * 100) / 100,
    };
}

export async function updatePlayerPfp(username: string, pfp: string): Promise<User> {
    const [player] = await db
        .update(users)
        .set({ pfp, updatedAt: new Date() })
        .where(eq(users.username, username))
        .returning();

    if (!player) {
        throw new Error("Player not found");
    }
    return player;
}

export async function recordWin(username: string, amount: number): Promise<void> {
    const result = await db
        .update(users)
        .set({
            wins: sql`${users.wins} + 1`,
            totalWon: sql`${users.totalWon} + ${amount}`,
            updatedAt: new Date(),
        })
        .where(eq(users.username, username));

    if (result.rowCount === 0) {
        throw new Error("Player not found");
    }
}

export async function recordLoss(username: string, amount: number): Promise<void> {
    const result = await db
        .update(users)
        .set({
            losses: sql`${users.losses} + 1`,
            totalLost: sql`${users.totalLost} + ${amount}`,
            updatedAt: new Date(),
        })
        .where(eq(users.username, username));

    if (result.rowCount === 0) {
        throw new Error("Player not found");
    }
}
