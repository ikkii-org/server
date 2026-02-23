import { Hono } from "hono";
import {
    createPlayerHandler,
    getProfileHandler,
    getPlayerByIdHandler,
    updatePfpHandler,
} from "../controllers/user.controller";

export const userRoutes = new Hono();

// POST /users                  — create a new player
userRoutes.post("/", createPlayerHandler);

// GET  /users/:id              — get player by UUID
userRoutes.get("/:id", getPlayerByIdHandler);

// GET  /users/:username/profile — get full profile (with portfolio stats)
userRoutes.get("/:username/profile", getProfileHandler);

// PATCH /users/:username/pfp   — update profile picture
userRoutes.patch("/:username/pfp", updatePfpHandler);
