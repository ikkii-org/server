import { z } from "zod";
import { usernameSchema, solanaAddressSchema } from "./user.validators";

// Re-export for use in controllers
export { usernameSchema };

// Duel ID: UUID format
export const duelIdSchema = z
    .string()
    .uuid("Invalid duel ID format");

export const createDuelSchema = z.object({
    username: usernameSchema,
    stakeAmount: z.number().positive("Stake amount must be positive"),
    tokenMint: solanaAddressSchema,
    gameId: z.string().optional(),
    expiresInMs: z.number().positive().optional(),
});

export const joinDuelSchema = z.object({
    username: usernameSchema,
});

export const submitResultSchema = z.object({
    username: usernameSchema,
    winnerUsername: usernameSchema,
});

export const cancelDuelSchema = z.object({
    username: usernameSchema,
});

export type CreateDuelInput = z.infer<typeof createDuelSchema>;
export type JoinDuelInput = z.infer<typeof joinDuelSchema>;
export type SubmitResultInput = z.infer<typeof submitResultSchema>;
export type CancelDuelInput = z.infer<typeof cancelDuelSchema>;
