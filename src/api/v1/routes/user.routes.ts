import { Hono } from "hono";
import { getProfileHandler, getPlayerByIdHandler, updatePfpHandler } from "../controllers/user.controller";

export const userRoutes = new Hono();

// NOTE: specific routes must be registered BEFORE the generic /:id wildcard
// otherwise Hono matches /:id first for paths like /someuser/profile.

// GET  /users/:username/profile — full profile with portfolio stats
userRoutes.get("/:username/profile", getProfileHandler);

// PATCH /users/:username/pfp   — update avatar
userRoutes.patch("/:username/pfp", updatePfpHandler);

// GET  /users/:id              — get player by UUID (keep last — broadest match)
userRoutes.get("/:id", getPlayerByIdHandler);
