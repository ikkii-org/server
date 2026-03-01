import { Context } from "hono";
import {
    createDuel,
    joinDuel,
    submitResult,
    cancelDuel,
    getDuel,
    cleanUpExpiredDuels,
} from "../services/duel.service";
import { createDuelSchema, submitResultSchema, duelIdSchema } from "../validators/duel.validators";

export async function createDuelHandler(c: Context) {
    try {
        const username = c.get("username") as string;
        const body = await c.req.json();
        const result = createDuelSchema.safeParse(body);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const { stakeAmount, tokenMint, gameId, expiresInMs } = result.data;
        const duel = await createDuel(username, stakeAmount, tokenMint, gameId, expiresInMs);
        return c.json({ duel }, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create duel";
        return c.json({ error: message }, 400);
    }
}

export async function joinDuelHandler(c: Context) {
    try {
        const duelIdResult = duelIdSchema.safeParse(c.req.param("id"));
        if (!duelIdResult.success) {
            return c.json({ error: duelIdResult.error.issues[0].message }, 400);
        }

        const username = c.get("username") as string;
        const duel = await joinDuel(duelIdResult.data, username);
        return c.json({ duel }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to join duel";
        return c.json({ error: message }, 400);
    }
}

export async function submitResultHandler(c: Context) {
    try {
        const duelIdResult = duelIdSchema.safeParse(c.req.param("id"));
        if (!duelIdResult.success) {
            return c.json({ error: duelIdResult.error.issues[0].message }, 400);
        }

        const username = c.get("username") as string;
        const body = await c.req.json();
        const result = submitResultSchema.safeParse(body);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const submitRes = await submitResult(duelIdResult.data, username, result.data.winnerUsername);
        return c.json(submitRes, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to submit result";
        return c.json({ error: message }, 400);
    }
}

export async function cancelDuelHandler(c: Context) {
    try {
        const duelIdResult = duelIdSchema.safeParse(c.req.param("id"));
        if (!duelIdResult.success) {
            return c.json({ error: duelIdResult.error.issues[0].message }, 400);
        }

        const username = c.get("username") as string;
        const duel = await cancelDuel(duelIdResult.data, username);
        return c.json({ duel }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cancel duel";
        return c.json({ error: message }, 400);
    }
}

export async function getDuelHandler(c: Context) {
    try {
        const duelIdResult = duelIdSchema.safeParse(c.req.param("id"));
        if (!duelIdResult.success) {
            return c.json({ error: duelIdResult.error.issues[0].message }, 400);
        }

        const duel = await getDuel(duelIdResult.data);
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
