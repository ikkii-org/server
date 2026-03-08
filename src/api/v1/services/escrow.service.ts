import { db } from "../../../db";
import { wallet, transactions } from "../../../db/schema";
import { eq, sql, desc } from "drizzle-orm";
import type { Wallet } from "../../../db/schema";

// ─── Transaction Logging ────────────────────────────────────────────────────────

/**
 * Helper to log a transaction row when funds move.
 */
export async function logTransaction(
    userId: string,
    duelId: string | null,
    type: "STAKE" | "REWARD" | "WITHDRAW" | "CLAIM",
    status: "PENDING" | "SUCCESS" | "FAILED",
    amount: number | string
) {
    if (!userId) return;

    await db.insert(transactions).values({
        userId,
        duelId: duelId || null,
        transactionType: type,
        transactionStatus: status,
        amount: amount.toString(),
    });
}

/**
 * Fetch transaction history for a user, ordered by most recent first
 */
export async function getTransactions(userId: string, limit = 50) {
    return await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, userId))
        .orderBy(desc(transactions.createdAt))
        .limit(limit);
}

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

    await logTransaction(userId, null, "STAKE", "SUCCESS", amount);

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

    await logTransaction(userId, null, "STAKE", "FAILED", amount); // refund essentially

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

        await tx.insert(transactions).values([
            {
                userId: loserUserId,
                transactionType: "STAKE",
                transactionStatus: "SUCCESS", // completed loss
                amount: amount.toString(),
            },
            {
                userId: winnerUserId,
                transactionType: "REWARD",
                transactionStatus: "SUCCESS",
                amount: amount.toString(),
            }
        ]);
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

    await logTransaction(userId, null, "CLAIM", "SUCCESS", amount);

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

    await logTransaction(userId, null, "WITHDRAW", "SUCCESS", amount);

    return updated;
}
