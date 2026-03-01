import { z } from "zod";
import { usernameSchema } from "./user.validators";

// Re-export for use in controllers
export { usernameSchema };

// Leaderboard limit: positive integer, 1-200, defaults to 50
export const limitSchema = z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1, "Limit must be at least 1").max(200, "Limit must be at most 200"));

// Leaderboard offset: non-negative integer, defaults to 0
export const offsetSchema = z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().int().min(0, "Offset must be non-negative"));

export type LimitInput = z.infer<typeof limitSchema>;
