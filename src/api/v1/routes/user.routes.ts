import { Hono } from "hono";
import { getProfileHandler, getPlayerByIdHandler, updatePfpHandler } from "../controllers/user.controller";

export const userRoutes = new Hono();

// GET  /users/:id              — get player by UUID
userRoutes.get("/:id", getPlayerByIdHandler);

// GET  /users/:username/profile — full profile with portfolio stats
userRoutes.get("/:username/profile", getProfileHandler);

// PATCH /users/:username/pfp   — update avatar
userRoutes.patch("/:username/pfp", updatePfpHandler);
