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
    stakeAmountSmallest: z.number().int().positive("stakeAmountSmallest must be a positive integer (smallest token unit)"),
    tokenMint: solanaAddressSchema,
    gameId: z.string().uuid().optional(),
    expiresInMs: z.number().positive().optional(),
    txSignature: z.string().min(1, "Transaction signature is required"),
    duelId: z.string().uuid("Invalid duel ID"),
});

export const joinDuelSchema = z.object({
    txSignature: z.string().min(1, "Transaction signature is required"),
});

export const cancelDuelSchema = z.object({
    txSignature: z.string().min(1, "Transaction signature is required"),
});

export const submitResultSchema = z.object({
    winnerUsername: usernameSchema,
});

export type CreateDuelInput = z.infer<typeof createDuelSchema>;
export type JoinDuelInput = z.infer<typeof joinDuelSchema>;
export type SubmitResultInput = z.infer<typeof submitResultSchema>;
