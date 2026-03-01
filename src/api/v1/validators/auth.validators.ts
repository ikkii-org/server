import { z } from "zod";
import { usernameSchema, solanaAddressSchema } from "./user.validators";

// Password validation
const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters");

// Profile picture URL (optional)
const pfpSchema = z
    .string()
    .url("Invalid URL format")
    .max(500, "URL must be at most 500 characters")
    .optional();

// Signup validation
export const signupSchema = z.object({
    username: usernameSchema,
    walletKey: solanaAddressSchema,
    password: passwordSchema,
    pfp: pfpSchema,
});

// Login validation
export const loginSchema = z.object({
    username: usernameSchema,
    password: passwordSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
