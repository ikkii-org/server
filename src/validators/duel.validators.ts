import { z } from "zod";

// Solana public key is base58 encoded, 32-44 characters
const solanaAddressSchema = z
    .string()
    .min(32)
    .max(44)
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Solana address");

// Username: alphanumeric, underscores, 3-20 chars
export const usernameSchema = z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

// Create duel validation
export const createDuelSchema = z.object({
    username: usernameSchema,
    stakeAmount: z.number().positive("Stake amount must be positive"),
    tokenMint: solanaAddressSchema,
    gameId: z.string().optional(),
    expiresInMs: z.number().positive().optional(),
});

// Join duel validation
export const joinDuelSchema = z.object({
    username: usernameSchema,
});

// Submit result validation
export const submitResultSchema = z.object({
    username: usernameSchema,
    winnerUsername: usernameSchema,
});

// Cancel duel validation
export const cancelDuelSchema = z.object({
    username: usernameSchema,
});

export type CreateDuelInput = z.infer<typeof createDuelSchema>;
export type JoinDuelInput = z.infer<typeof joinDuelSchema>;
export type SubmitResultInput = z.infer<typeof submitResultSchema>;
export type CancelDuelInput = z.infer<typeof cancelDuelSchema>;
