import { z } from "zod";
import { usernameSchema, solanaAddressSchema } from "./user.validators";

// Password validation
const passwordSchema = z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must be at most 100 characters");

// Profile picture: base64 data URI (optional at signup)
const pfpSchema = z
    .string()
    .max(3_000_000, "Image is too large (max ~2MB)")
    .regex(
        /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+=*$/,
        "Must be a base64 data URI (data:image/...;base64,...)"
    )
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
