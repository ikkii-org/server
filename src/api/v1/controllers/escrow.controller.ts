import { Context } from "hono";
import {
    createWallet,
    getWallet,
    depositFunds,
    withdrawFunds,
    lockFunds,
    unlockFunds,
    transferStake,
    getTransactions,
    logTransaction,
} from "../services/escrow.service";

const MAX_AMOUNT = 1_000_000;

function validateAmount(amount: unknown): number {
    if (typeof amount !== "number" || isNaN(amount)) {
        throw new Error("Amount must be a valid number");
    }
    if (amount <= 0) {
        throw new Error("Amount must be positive");
    }
    if (amount > MAX_AMOUNT) {
        throw new Error(`Amount exceeds maximum of ${MAX_AMOUNT}`);
    }
    return amount;
}

function requireSelf(c: Context, userId: string): Response | null {
    if (c.get("userId") !== userId) {
        return c.json({ error: "Forbidden" }, 403) as Response;
    }
    return null;
}

export async function createWalletHandler(c: Context) {
    try {
        const { userId, token } = await c.req.json();

        if (!userId || !token) {
            return c.json({ error: "Missing required fields: userId, token" }, 400);
        }

        const w = await createWallet(userId, token);
        return c.json({ wallet: w }, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create wallet";
        return c.json({ error: message }, 400);
    }
}

export async function getWalletHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const forbidden = requireSelf(c, userId);
        if (forbidden) return forbidden;

        const w = await getWallet(userId);
        return c.json({ wallet: w }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Wallet not found";
        return c.json({ error: message }, 404);
    }
}

export async function getTransactionsHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const forbidden = requireSelf(c, userId);
        if (forbidden) return forbidden;

        const limit = Number(c.req.query("limit")) || 50;
        const txs = await getTransactions(userId, limit);

        return c.json({ transactions: txs }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch transactions";
        return c.json({ error: message }, 400);
    }
}

export async function depositHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const forbidden = requireSelf(c, userId);
        if (forbidden) return forbidden;

        const { amount } = await c.req.json();
        const validatedAmount = validateAmount(amount);

        const w = await depositFunds(userId, validatedAmount);
        return c.json({ wallet: w }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to deposit funds";
        return c.json({ error: message }, 400);
    }
}

export async function withdrawHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const forbidden = requireSelf(c, userId);
        if (forbidden) return forbidden;

        const { amount } = await c.req.json();
        const validatedAmount = validateAmount(amount);

        const w = await withdrawFunds(userId, validatedAmount);
        return c.json({ wallet: w }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to withdraw funds";
        return c.json({ error: message }, 400);
    }
}

export async function lockFundsHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const { amount } = await c.req.json();
        const validatedAmount = validateAmount(amount);

        const w = await lockFunds(userId, validatedAmount);
        return c.json({ wallet: w }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to lock funds";
        return c.json({ error: message }, 400);
    }
}

export async function unlockFundsHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const { amount } = await c.req.json();
        const validatedAmount = validateAmount(amount);

        const w = await unlockFunds(userId, validatedAmount);
        return c.json({ wallet: w }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to unlock funds";
        return c.json({ error: message }, 400);
    }
}

export async function transferStakeHandler(c: Context) {
    try {
        const { loserUserId, winnerUserId, amount } = await c.req.json();

        if (!loserUserId || !winnerUserId || !amount || amount <= 0) {
            return c.json(
                { error: "Missing required fields: loserUserId, winnerUserId, amount" },
                400
            );
        }

        await transferStake(loserUserId, winnerUserId, amount);
        return c.json({ success: true }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to transfer stake";
        return c.json({ error: message }, 400);
    }
}

export async function recordTransactionHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const forbidden = requireSelf(c, userId);
        if (forbidden) return forbidden;

        const { type, amount, duelId } = await c.req.json();

        const validTypes = ["STAKE", "REWARD", "WITHDRAW", "CLAIM", "DEPOSIT"];
        if (!type || !validTypes.includes(type)) {
            return c.json({ error: `type must be one of: ${validTypes.join(", ")}` }, 400);
        }

        if (amount === undefined || amount === null) {
            return c.json({ error: "amount is required" }, 400);
        }

        await logTransaction(userId, duelId ?? null, type, "SUCCESS", amount);
        return c.json({ success: true }, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to record transaction";
        return c.json({ error: message }, 400);
    }
}
