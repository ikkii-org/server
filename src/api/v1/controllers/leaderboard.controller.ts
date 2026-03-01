import { Context } from "hono";
import { getLeaderboard, getPlayerRank, refreshRanks } from "../services/leaderboard.service";
import { limitSchema, offsetSchema, usernameSchema } from "../validators/leaderboard.validators";

export async function getLeaderboardHandler(c: Context) {
    try {
        const limitResult = limitSchema.safeParse(c.req.query("limit"));
        if (!limitResult.success) {
            return c.json({ error: limitResult.error.issues[0].message }, 400);
        }

        const offsetResult = offsetSchema.safeParse(c.req.query("offset"));
        if (!offsetResult.success) {
            return c.json({ error: offsetResult.error.issues[0].message }, 400);
        }

        const board = await getLeaderboard(limitResult.data, offsetResult.data);
        return c.json({ leaderboard: board, count: board.length, offset: offsetResult.data }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch leaderboard";
        return c.json({ error: message }, 500);
    }
}

export async function getPlayerRankHandler(c: Context) {
    try {
        const usernameResult = usernameSchema.safeParse(c.req.param("username"));
        if (!usernameResult.success) {
            return c.json({ error: usernameResult.error.issues[0].message }, 400);
        }

        const entry = await getPlayerRank(usernameResult.data);

        if (!entry) {
            return c.json({ error: "Player not found on leaderboard" }, 404);
        }

        return c.json({ entry }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch player rank";
        return c.json({ error: message }, 500);
    }
}

export async function refreshRanksHandler(c: Context) {
    try {
        await refreshRanks();
        return c.json({ success: true, message: "Ranks refreshed" }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to refresh ranks";
        return c.json({ error: message }, 500);
    }
}
