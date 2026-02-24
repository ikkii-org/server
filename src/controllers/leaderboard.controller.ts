import { Context } from "hono";
import { getLeaderboard, getPlayerRank, refreshRanks } from "../services/leaderboard.service";
import { limitSchema, usernameSchema } from "../validators/leaderboard.validators";

export async function getLeaderboardHandler(c: Context) {
    try {
        const limitParam = c.req.query("limit");
        const limitResult = limitSchema.safeParse(limitParam);

        if (!limitResult.success) {
            return c.json({ error: limitResult.error.issues[0].message }, 400);
        }

        const limit = limitResult.data;
        const board = await getLeaderboard(limit);
        return c.json({ leaderboard: board, count: board.length }, 200);
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
