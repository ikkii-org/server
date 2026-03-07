import { z } from "zod";

export const linkGameAccountSchema = z.object({
  gameName: z.string().min(1, "Game name is required"),
  playerId: z.string().min(1, "Player ID is required"),
  /**
   * Ownership verification: the user's career total wins count.
   * Visible in the player's own profile stats page.
   * Verified with ±5 tolerance (games played mid-verification).
   */
  claimedWins: z.number().int("claimedWins must be a whole number").nonnegative("claimedWins must be 0 or greater").optional(),
  /**
   * Ownership verification: the user's all-time challenge max wins.
   * Only visible to the account owner (Settings → Stats → Challenge).
   * Verified with exact match (a personal best, doesn't change mid-session).
   */
  claimedChallengeMaxWins: z.number().int("claimedChallengeMaxWins must be a whole number").nonnegative("claimedChallengeMaxWins must be 0 or greater").optional(),
});

export const syncGameProfileSchema = z.object({
  gameName: z.string().min(1, "Game name is required"),
});

export const gameNameParamSchema = z.string().min(1, "Game name is required");

export type LinkGameAccountInput = z.infer<typeof linkGameAccountSchema>;
