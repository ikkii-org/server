import { z } from "zod";
import { usernameSchema } from "./duel.validators";

// Re-export for use in controllers
export { usernameSchema };

// Leaderboard limit: positive integer, 1-200, defaults to 50
export const limitSchema = z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().int().min(1, "Limit must be at least 1").max(200, "Limit must be at most 200"));

export type LimitInput = z.infer<typeof limitSchema>;
