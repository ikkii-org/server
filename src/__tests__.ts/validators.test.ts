import { describe, it, expect } from "bun:test";
import { signupSchema, loginSchema } from "../validators/auth.validators";
import { createDuelSchema, submitResultSchema, duelIdSchema } from "../validators/duel.validators";
import { usernameSchema, userIdSchema, updatePfpSchema } from "../validators/user.validators";
import { limitSchema, offsetSchema } from "../validators/leaderboard.validators";

// ─── Auth Validators ──────────────────────────────────────────────────────────

describe("signupSchema", () => {
    it("accepts valid input", () => {
        const result = signupSchema.safeParse({
            username: "alice",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "securepass",
        });
        expect(result.success).toBe(true);
    });

    it("rejects short username", () => {
        const result = signupSchema.safeParse({
            username: "ab",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "securepass",
        });
        expect(result.success).toBe(false);
    });

    it("rejects short password", () => {
        const result = signupSchema.safeParse({
            username: "alice",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "short",
        });
        expect(result.success).toBe(false);
    });

    it("rejects username with special characters", () => {
        const result = signupSchema.safeParse({
            username: "alice!",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "securepass",
        });
        expect(result.success).toBe(false);
    });

    it("rejects invalid Solana address", () => {
        const result = signupSchema.safeParse({
            username: "alice",
            walletKey: "not-a-valid-address",
            password: "securepass",
        });
        expect(result.success).toBe(false);
    });

    it("accepts optional pfp URL", () => {
        const result = signupSchema.safeParse({
            username: "alice",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "securepass",
            pfp: "https://example.com/avatar.png",
        });
        expect(result.success).toBe(true);
    });

    it("rejects invalid pfp URL", () => {
        const result = signupSchema.safeParse({
            username: "alice",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "securepass",
            pfp: "not-a-url",
        });
        expect(result.success).toBe(false);
    });
});

describe("loginSchema", () => {
    it("accepts valid credentials", () => {
        const result = loginSchema.safeParse({ username: "alice", password: "securepass" });
        expect(result.success).toBe(true);
    });

    it("rejects missing password", () => {
        const result = loginSchema.safeParse({ username: "alice" });
        expect(result.success).toBe(false);
    });
});

// ─── User Validators ──────────────────────────────────────────────────────────

describe("usernameSchema", () => {
    it("accepts valid usernames", () => {
        expect(usernameSchema.safeParse("alice_123").success).toBe(true);
        expect(usernameSchema.safeParse("ALICE").success).toBe(true);
    });

    it("rejects usernames that are too short", () => {
        expect(usernameSchema.safeParse("ab").success).toBe(false);
    });

    it("rejects usernames that are too long", () => {
        expect(usernameSchema.safeParse("a".repeat(21)).success).toBe(false);
    });

    it("rejects usernames with hyphens or spaces", () => {
        expect(usernameSchema.safeParse("alice-bob").success).toBe(false);
        expect(usernameSchema.safeParse("alice bob").success).toBe(false);
    });
});

describe("userIdSchema", () => {
    it("accepts valid UUIDs", () => {
        expect(userIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    });

    it("rejects non-UUID strings", () => {
        expect(userIdSchema.safeParse("12345").success).toBe(false);
        expect(userIdSchema.safeParse("not-a-uuid").success).toBe(false);
    });
});

describe("updatePfpSchema", () => {
    it("accepts valid URL", () => {
        expect(updatePfpSchema.safeParse({ pfp: "https://cdn.example.com/img.png" }).success).toBe(true);
    });

    it("rejects non-URL", () => {
        expect(updatePfpSchema.safeParse({ pfp: "just-a-string" }).success).toBe(false);
    });
});

// ─── Duel Validators ──────────────────────────────────────────────────────────

describe("duelIdSchema", () => {
    it("accepts valid UUID", () => {
        expect(duelIdSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
    });

    it("rejects non-UUID", () => {
        expect(duelIdSchema.safeParse("not-a-uuid").success).toBe(false);
    });
});

describe("createDuelSchema", () => {
    it("accepts valid input", () => {
        const result = createDuelSchema.safeParse({
            stakeAmount: 1.5,
            tokenMint: "So11111111111111111111111111111111111111112",
        });
        expect(result.success).toBe(true);
    });

    it("rejects zero or negative stake amount", () => {
        expect(createDuelSchema.safeParse({ stakeAmount: 0, tokenMint: "So11111111111111111111111111111111111111112" }).success).toBe(false);
        expect(createDuelSchema.safeParse({ stakeAmount: -1, tokenMint: "So11111111111111111111111111111111111111112" }).success).toBe(false);
    });

    it("rejects missing tokenMint", () => {
        expect(createDuelSchema.safeParse({ stakeAmount: 1.0 }).success).toBe(false);
    });

    it("rejects invalid gameId (non-UUID)", () => {
        const result = createDuelSchema.safeParse({
            stakeAmount: 1.0,
            tokenMint: "So11111111111111111111111111111111111111112",
            gameId: "not-a-uuid",
        });
        expect(result.success).toBe(false);
    });

    it("accepts optional UUID gameId", () => {
        const result = createDuelSchema.safeParse({
            stakeAmount: 1.0,
            tokenMint: "So11111111111111111111111111111111111111112",
            gameId: "550e8400-e29b-41d4-a716-446655440000",
        });
        expect(result.success).toBe(true);
    });
});

describe("submitResultSchema", () => {
    it("accepts valid winner username", () => {
        expect(submitResultSchema.safeParse({ winnerUsername: "alice" }).success).toBe(true);
    });

    it("rejects missing winnerUsername", () => {
        expect(submitResultSchema.safeParse({}).success).toBe(false);
    });
});

// ─── Leaderboard Validators ───────────────────────────────────────────────────

describe("limitSchema", () => {
    it("defaults to 50 when undefined", () => {
        const result = limitSchema.safeParse(undefined);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(50);
    });

    it("accepts valid limit string", () => {
        const result = limitSchema.safeParse("100");
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(100);
    });

    it("rejects limit > 200", () => {
        expect(limitSchema.safeParse("201").success).toBe(false);
    });

    it("rejects limit < 1", () => {
        expect(limitSchema.safeParse("0").success).toBe(false);
    });
});

describe("offsetSchema", () => {
    it("defaults to 0 when undefined", () => {
        const result = offsetSchema.safeParse(undefined);
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(0);
    });

    it("accepts valid offset string", () => {
        const result = offsetSchema.safeParse("50");
        expect(result.success).toBe(true);
        if (result.success) expect(result.data).toBe(50);
    });

    it("rejects negative offset", () => {
        expect(offsetSchema.safeParse("-1").success).toBe(false);
    });
});
