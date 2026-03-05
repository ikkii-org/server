import { Hono } from "hono";
import {
  linkGameAccountHandler,
  syncGameProfileHandler,
  getGameProfilesHandler,
  getGameProfileHandler,
} from "../controllers/game-profile.controller";

export const gameProfileRoutes = new Hono();

// GET  /game-profiles            — get all linked game profiles
gameProfileRoutes.get("/", getGameProfilesHandler);

// GET  /game-profiles/:gameName  — get specific game profile
gameProfileRoutes.get("/:gameName", getGameProfileHandler);

// POST /game-profiles/link       — link a game account
gameProfileRoutes.post("/link", linkGameAccountHandler);

// POST /game-profiles/sync       — sync stats from game API
gameProfileRoutes.post("/sync", syncGameProfileHandler);
