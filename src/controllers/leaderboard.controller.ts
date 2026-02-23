import { Context } from "hono";
import { getLeaderboard, getPlayerRank, refreshRanks } from "../services/leaderboard.service";

export async function getLeaderboardHandler(c: Context) {
    try {
        const limitParam = c.req.query("limit");
        const limit = limitParam ? Math.min(parseInt(limitParam, 10), 200) : 50;

        const board = await getLeaderboard(limit);
        return c.json({ leaderboard: board, count: board.length }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch leaderboard";
        return c.json({ error: message }, 500);
    }
}

export async function getPlayerRankHandler(c: Context) {
    try {
        const username = c.req.param("username");
        const entry = await getPlayerRank(username);

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
