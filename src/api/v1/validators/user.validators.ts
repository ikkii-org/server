import { z } from "zod";

// ─── Common schemas ───────────────────────────────────────────────────────────

// Username: alphanumeric, underscores, 3-20 chars
export const usernameSchema = z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores");

// Solana wallet/token address: base58 encoded, 32-44 characters
export const solanaAddressSchema = z
    .string()
    .min(32, "Address must be at least 32 characters")
    .max(44, "Address must be at most 44 characters")
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid Solana address");

// ─── User-specific schemas ────────────────────────────────────────────────────

// User ID: UUID v4
export const userIdSchema = z.string().uuid("Invalid user ID");

// Profile picture: base64 data URI (max ~2MB encoded ≈ ~2.7M chars)
const MAX_PFP_LENGTH = 3_000_000;

const pfpSchema = z
    .string()
    .max(MAX_PFP_LENGTH, "Image is too large (max ~2MB)")
    .regex(
        /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/,
        "Must be a base64 data URI (data:image/...;base64,...)"
    );

export const updatePfpSchema = z.object({
    pfp: pfpSchema,
});

export type UpdatePfpInput = z.infer<typeof updatePfpSchema>;
