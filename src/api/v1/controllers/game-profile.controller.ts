import { Context } from "hono";
import {
  linkGameAccount,
  syncGameProfile,
  getUserGameProfiles,
  getGameProfile,
} from "../services/game-profile.service";
import {
  linkGameAccountSchema,
  syncGameProfileSchema,
  gameNameParamSchema,
} from "../validators/game-profile.validators";

/**
 * POST /game-profiles/link
 * Link a game account to the authenticated user.
 */
export async function linkGameAccountHandler(c: Context) {
  try {
    const userId = c.get("userId") as string;
    const body = await c.req.json();

    const result = linkGameAccountSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.issues[0].message }, 400);
    }

    const { gameName, playerId, claimedWins, claimedChallengeMaxWins } = result.data;
    const syncResult = await linkGameAccount(userId, gameName, playerId, claimedWins, claimedChallengeMaxWins);

    if (!syncResult.success) {
      return c.json({ error: syncResult.error }, 400);
    }

    return c.json({ profile: syncResult.profile }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to link account";
    return c.json({ error: message }, 500);
  }
}

/**
 * POST /game-profiles/sync
 * Sync stats from the game's API for the authenticated user.
 */
export async function syncGameProfileHandler(c: Context) {
  try {
    const userId = c.get("userId") as string;
    const body = await c.req.json();

    const result = syncGameProfileSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: result.error.issues[0].message }, 400);
    }

    const { gameName } = result.data;
    const syncResult = await syncGameProfile(userId, gameName);

    if (!syncResult.success) {
      return c.json({ error: syncResult.error }, 400);
    }

    return c.json({ profile: syncResult.profile }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to sync profile";
    return c.json({ error: message }, 500);
  }
}

/**
 * GET /game-profiles
 * Get all linked game profiles for the authenticated user.
 */
export async function getGameProfilesHandler(c: Context) {
  try {
    const userId = c.get("userId") as string;
    const profiles = await getUserGameProfiles(userId);
    return c.json({ profiles }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get profiles";
    return c.json({ error: message }, 500);
  }
}

/**
 * GET /game-profiles/:gameName
 * Get a specific game profile for the authenticated user.
 */
export async function getGameProfileHandler(c: Context) {
  try {
    const userId = c.get("userId") as string;
    const gameName = c.req.param("gameName");

    const result = gameNameParamSchema.safeParse(gameName);
    if (!result.success) {
      return c.json({ error: result.error.issues[0].message }, 400);
    }

    const profile = await getGameProfile(userId, result.data);

    if (!profile) {
      return c.json({ error: "Game profile not found" }, 404);
    }

    return c.json({ profile }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get profile";
    return c.json({ error: message }, 500);
  }
}
