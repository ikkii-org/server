import { Hono } from "hono";
import {
    createDuelHandler,
    joinDuelHandler,
    submitResultHandler,
    cancelDuelHandler,
    getDuelHandler,
    cleanUpExpiredDuelsHandler,
} from "../controllers/duel.controller";
import { adminMiddleware } from "../middleware/admin.middleware";

export const duelRoutes = new Hono();

// POST /duels            — create a new duel
duelRoutes.post("/", createDuelHandler);

// GET  /duels/:id        — fetch a duel by id
duelRoutes.get("/:id", getDuelHandler);

// POST /duels/:id/join   — join an open duel as player 2
duelRoutes.post("/:id/join", joinDuelHandler);

// POST /duels/:id/result — submit a result claim
duelRoutes.post("/:id/result", submitResultHandler);

// POST /duels/:id/cancel — cancel an open duel (creator only)
duelRoutes.post("/:id/cancel", cancelDuelHandler);

// POST /duels/cleanup    — cancel all expired open duels (admin only)
duelRoutes.post("/cleanup", adminMiddleware, cleanUpExpiredDuelsHandler);

