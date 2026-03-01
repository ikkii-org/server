import { Hono } from "hono";
import { verifyDuelHandler } from "../controllers/verification.controller";

export const verificationRoutes = new Hono();

// POST /verification/duels/:id — auto-verify a DISPUTED duel
verificationRoutes.post("/duels/:id", verifyDuelHandler);
