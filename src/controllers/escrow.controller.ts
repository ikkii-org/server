import { Context } from "hono";
import {
    createWallet,
    getWallet,
    lockFunds,
    unlockFunds,
    depositFunds,
    withdrawFunds,
    transferStake,
} from "../services/escrow.service";

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
        const w = await getWallet(userId);
        return c.json({ wallet: w }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Wallet not found";
        return c.json({ error: message }, 404);
    }
}

export async function depositHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const { amount } = await c.req.json();

        if (!amount || amount <= 0) {
            return c.json({ error: "amount must be a positive number" }, 400);
        }

        const w = await depositFunds(userId, amount);
        return c.json({ wallet: w }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to deposit funds";
        return c.json({ error: message }, 400);
    }
}

export async function withdrawHandler(c: Context) {
    try {
        const userId = c.req.param("userId");
        const { amount } = await c.req.json();

        if (!amount || amount <= 0) {
            return c.json({ error: "amount must be a positive number" }, 400);
        }

        const w = await withdrawFunds(userId, amount);
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

        if (!amount || amount <= 0) {
            return c.json({ error: "amount must be a positive number" }, 400);
        }

        const w = await lockFunds(userId, amount);
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

        if (!amount || amount <= 0) {
            return c.json({ error: "amount must be a positive number" }, 400);
        }

        const w = await unlockFunds(userId, amount);
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
