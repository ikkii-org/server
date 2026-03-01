import { db } from "../db";
import { wallet } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import type { Wallet } from "../db/schema";

// ─── Wallet CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a wallet for a user (token = SPL token mint address).
 */
export async function createWallet(userId: string, token: string): Promise<Wallet> {
    if (!userId) throw new Error("User ID is required");
    if (!token) throw new Error("Token mint is required");

    const [w] = await db
        .insert(wallet)
        .values({ userId, token, availableBalance: "0", lockedBalance: "0" })
        .returning();

    return w;
}

/**
 * Fetch a user's wallet. Throws if no wallet exists.
 */
export async function getWallet(userId: string): Promise<Wallet> {
    const [w] = await db.select().from(wallet).where(eq(wallet.userId, userId));
    if (!w) throw new Error("Wallet not found");
    return w;
}

/**
 * Move `amount` from availableBalance into lockedBalance (e.g. when creating a duel).
 * Throws if the user does not have enough available balance.
 */
export async function lockFunds(userId: string, amount: number): Promise<Wallet> {
    const w = await getWallet(userId);

    if (parseFloat(w.availableBalance ?? "0") < amount) {
        throw new Error("Insufficient available balance");
    }

    const [updated] = await db
        .update(wallet)
        .set({
            availableBalance: sql`${wallet.availableBalance} - ${amount}`,
            lockedBalance: sql`${wallet.lockedBalance} + ${amount}`,
        })
        .where(eq(wallet.userId, userId))
        .returning();

    return updated;
}

/**
 * Release `amount` from lockedBalance back to availableBalance (e.g. duel cancelled).
 */
export async function unlockFunds(userId: string, amount: number): Promise<Wallet> {
    const [updated] = await db
        .update(wallet)
        .set({
            availableBalance: sql`${wallet.availableBalance} + ${amount}`,
            lockedBalance: sql`${wallet.lockedBalance} - ${amount}`,
        })
        .where(eq(wallet.userId, userId))
        .returning();

    if (!updated) throw new Error("Wallet not found");
    return updated;
}

/**
 * Deduct `amount` from lockedBalance and credit it to the winner's availableBalance.
 * Used after a duel is settled. Wrapped in a single DB transaction for atomicity.
 */
export async function transferStake(
    loserUserId: string,
    winnerUserId: string,
    amount: number
): Promise<void> {
    await db.transaction(async (tx) => {
        await tx
            .update(wallet)
            .set({ lockedBalance: sql`${wallet.lockedBalance} - ${amount}` })
            .where(eq(wallet.userId, loserUserId));

        await tx
            .update(wallet)
            .set({ availableBalance: sql`${wallet.availableBalance} + ${amount}` })
            .where(eq(wallet.userId, winnerUserId));
    });
}

/**
 * Deposit (add) funds to a user's available balance (e.g. on-chain deposit confirmed).
 */
export async function depositFunds(userId: string, amount: number): Promise<Wallet> {
    const [updated] = await db
        .update(wallet)
        .set({ availableBalance: sql`${wallet.availableBalance} + ${amount}` })
        .where(eq(wallet.userId, userId))
        .returning();

    if (!updated) throw new Error("Wallet not found");
    return updated;
}

/**
 * Withdraw (reduce) funds from a user's available balance.
 */
export async function withdrawFunds(userId: string, amount: number): Promise<Wallet> {
    const w = await getWallet(userId);

    if (parseFloat(w.availableBalance ?? "0") < amount) {
        throw new Error("Insufficient available balance");
    }

    const [updated] = await db
        .update(wallet)
        .set({ availableBalance: sql`${wallet.availableBalance} - ${amount}` })
        .where(eq(wallet.userId, userId))
        .returning();

    return updated;
}
