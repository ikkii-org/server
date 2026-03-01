import { Hono } from "hono";
import {
    getLeaderboardHandler,
    getPlayerRankHandler,
    refreshRanksHandler,
} from "../controllers/leaderboard.controller";
import { adminMiddleware } from "../../../middleware/admin.middleware";

export const leaderboardRoutes = new Hono();

// GET  /leaderboard                     — top players (?limit=N&offset=M)
leaderboardRoutes.get("/", getLeaderboardHandler);

// GET  /leaderboard/:username           — rank entry for a specific player
leaderboardRoutes.get("/:username", getPlayerRankHandler);

// POST /leaderboard/refresh             — recalculate & persist all ranks (admin only)
leaderboardRoutes.post("/refresh", adminMiddleware, refreshRanksHandler);
