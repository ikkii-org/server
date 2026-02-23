import { Context } from "hono";
import {
    createDuel,
    joinDuel,
    submitResult,
    cancelDuel,
    getDuel,
    cleanUpExpiredDuels,
} from "../services/duel.service";

export async function createDuelHandler(c: Context) {
    try {
        const { username, stakeAmount, tokenMint, gameId, expiresInMs } = await c.req.json();

        if (!username || !stakeAmount || !tokenMint) {
            return c.json({ error: "Missing required fields: username, stakeAmount, tokenMint" }, 400);
        }

        const duel = await createDuel(username, stakeAmount, tokenMint, gameId, expiresInMs);
        return c.json({ duel }, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create duel";
        return c.json({ error: message }, 400);
    }
}

export async function joinDuelHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const { username } = await c.req.json();

        if (!username) {
            return c.json({ error: "Missing required field: username" }, 400);
        }

        const duel = await joinDuel(duelId, username);
        return c.json({ duel }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to join duel";
        return c.json({ error: message }, 400);
    }
}

export async function submitResultHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const { username, winnerUsername } = await c.req.json();

        if (!username || !winnerUsername) {
            return c.json({ error: "Missing required fields: username, winnerUsername" }, 400);
        }

        const result = await submitResult(duelId, username, winnerUsername);
        return c.json(result, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit result";
        return c.json({ error: message }, 400);
    }
}

export async function cancelDuelHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const { username } = await c.req.json();

        if (!username) {
            return c.json({ error: "Missing required field: username" }, 400);
        }

        const duel = await cancelDuel(duelId, username);
        return c.json({ duel }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cancel duel";
        return c.json({ error: message }, 400);
    }
}

export async function getDuelHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const duel = await getDuel(duelId);
        return c.json({ duel }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Duel not found";
        return c.json({ error: message }, 404);
    }
}

export async function cleanUpExpiredDuelsHandler(c: Context) {
    try {
        const count = await cleanUpExpiredDuels();
        return c.json({ cancelledCount: count }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to clean up duels";
        return c.json({ error: message }, 500);
    }
}
