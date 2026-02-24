import { z } from "zod";
import { usernameSchema } from "./duel.validators";

// Re-export for use in controllers
export { usernameSchema };

// User ID: positive integer as string
export const userIdSchema = z
    .string()
    .regex(/^\d+$/, "Invalid user ID")
    .transform(Number)
    .pipe(z.number().positive("User ID must be positive"));

// URL validation for profile picture
const pfpSchema = z
    .string()
    .url("Invalid URL format")
    .max(500, "URL must be at most 500 characters");

// Update profile picture validation
export const updatePfpSchema = z.object({
    pfp: pfpSchema,
});

export type UpdatePfpInput = z.infer<typeof updatePfpSchema>;
