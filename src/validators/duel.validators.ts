import { z } from "zod";
import { usernameSchema, solanaAddressSchema } from "./user.validators";

// Re-export for use in controllers
export { usernameSchema };

// Duel ID: UUID format
export const duelIdSchema = z
    .string()
    .uuid("Invalid duel ID format");

export const createDuelSchema = z.object({
    stakeAmount: z.number().positive("Stake amount must be positive"),
    tokenMint: solanaAddressSchema,
    gameId: z.string().uuid().optional(),
    expiresInMs: z.number().positive().optional(),
});

export const submitResultSchema = z.object({
    winnerUsername: usernameSchema,
});

export type CreateDuelInput = z.infer<typeof createDuelSchema>;
export type SubmitResultInput = z.infer<typeof submitResultSchema>;
