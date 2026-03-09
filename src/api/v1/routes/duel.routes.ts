import { Hono } from "hono";
import {
    createDuelHandler,
    joinDuelHandler,
    submitResultHandler,
    cancelDuelHandler,
    cancelExpiredDuelHandler,
    getDuelHandler,
    getDuelsByStatusHandler,
    cleanUpExpiredDuelsHandler,
} from "../controllers/duel.controller";
import { adminMiddleware } from "../../../middleware/admin.middleware";

export const duelRoutes = new Hono();

// POST /duels            — create a new duel
duelRoutes.post("/", createDuelHandler);

// GET  /duels?status=    — list duels by status
duelRoutes.get("/", getDuelsByStatusHandler);

// GET  /duels/:id        — fetch a duel by id
duelRoutes.get("/:id", getDuelHandler);

// POST /duels/:id/join   — join an open duel as player 2
duelRoutes.post("/:id/join", joinDuelHandler);

// POST /duels/:id/result — submit a result claim
duelRoutes.post("/:id/result", submitResultHandler);

// POST /duels/:id/cancel         — cancel an open duel (creator only, not expired)
duelRoutes.post("/:id/cancel", cancelDuelHandler);

// POST /duels/:id/cancel-expired  — server-side refund for expired unjoined duels (no wallet tx)
duelRoutes.post("/:id/cancel-expired", cancelExpiredDuelHandler);

// POST /duels/cleanup    — cancel all expired open duels (admin only)
duelRoutes.post("/cleanup", adminMiddleware, cleanUpExpiredDuelsHandler);

