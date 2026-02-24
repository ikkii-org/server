import { Context } from "hono";
import {
    createDuel,
    joinDuel,
    submitResult,
    cancelDuel,
    getDuel,
    cleanUpExpiredDuels,
} from "../services/duel.service";
import { createDuelSchema, joinDuelSchema, submitResultSchema, cancelDuelSchema } from "../validators/duel.validators";

export async function createDuelHandler(c: Context) {
    try {
        const body = await c.req.json();
        const result = createDuelSchema.safeParse(body);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const { username, stakeAmount, tokenMint, gameId, expiresInMs } = result.data;
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
        const body = await c.req.json();
        const result = joinDuelSchema.safeParse(body);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const duel = await joinDuel(duelId, result.data.username);
        return c.json({ duel }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to join duel";
        return c.json({ error: message }, 400);
    }
}

export async function submitResultHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const body = await c.req.json();
        const result = submitResultSchema.safeParse(body);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const { username, winnerUsername } = result.data;
        const submitRes = await submitResult(duelId, username, winnerUsername);
        return c.json(submitRes, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit result";
        return c.json({ error: message }, 400);
    }
}

export async function cancelDuelHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const body = await c.req.json();
        const result = cancelDuelSchema.safeParse(body);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const duel = await cancelDuel(duelId, result.data.username);
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
