import { Hono } from "hono";
import {
    getLeaderboardHandler,
    getPlayerRankHandler,
    refreshRanksHandler,
} from "../controllers/leaderboard.controller";

export const leaderboardRoutes = new Hono();

// GET  /leaderboard                     — top players (optional ?limit=N, max 200)
leaderboardRoutes.get("/", getLeaderboardHandler);

// GET  /leaderboard/:username           — rank entry for a specific player
leaderboardRoutes.get("/:username", getPlayerRankHandler);

// POST /leaderboard/refresh             — recalculate & persist all ranks
leaderboardRoutes.post("/refresh", refreshRanksHandler);
