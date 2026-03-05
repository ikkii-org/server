import { z } from "zod";

export const linkGameAccountSchema = z.object({
  gameName: z.string().min(1, "Game name is required"),
  playerId: z.string().min(1, "Player ID is required"),
});

export const syncGameProfileSchema = z.object({
  gameName: z.string().min(1, "Game name is required"),
});

export const gameNameParamSchema = z.string().min(1, "Game name is required");
