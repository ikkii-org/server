import { Hono } from "hono";
import {
    createDuelHandler,
    joinDuelHandler,
    submitResultHandler,
    cancelDuelHandler,
    getDuelHandler,
} from "../controllers/duel.controller";

export const duelRoutes = new Hono();

duelRoutes.post("/", createDuelHandler);

duelRoutes.post("/:id/join", joinDuelHandler);

duelRoutes.post("/:id/result", submitResultHandler);

duelRoutes.post("/:id/cancel", cancelDuelHandler);

duelRoutes.get("/:id", getDuelHandler);
