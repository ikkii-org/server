import { z } from "zod";
import { usernameSchema } from "./duel.validators";

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
