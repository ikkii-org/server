import { describe, it, expect } from "bun:test";
import { signupSchema, loginSchema } from "../api/v1/validators/auth.validators";
import { createDuelSchema, submitResultSchema, duelIdSchema } from "../api/v1/validators/duel.validators";
import { usernameSchema, userIdSchema, updatePfpSchema } from "../api/v1/validators/user.validators";
import { limitSchema, offsetSchema } from "../api/v1/validators/leaderboard.validators";
import { linkGameAccountSchema } from "../api/v1/validators/game-profile.validators";

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

    it("accepts optional pfp as base64 data URI", () => {
        const result = signupSchema.safeParse({
            username: "alice",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "securepass",
            pfp: "data:image/png;base64,iVBORw0KGgo=",
        });
        expect(result.success).toBe(true);
    });

    it("rejects pfp that is not a base64 data URI", () => {
        const result = signupSchema.safeParse({
            username: "alice",
            walletKey: "So11111111111111111111111111111111111111112",
            password: "securepass",
            pfp: "https://example.com/avatar.png",
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
    it("accepts valid base64 data URI", () => {
        expect(updatePfpSchema.safeParse({ pfp: "data:image/jpeg;base64,/9j/4AAQ=" }).success).toBe(true);
    });

    it("rejects plain URL (not a base64 data URI)", () => {
        expect(updatePfpSchema.safeParse({ pfp: "https://cdn.example.com/img.png" }).success).toBe(false);
    });

    it("rejects arbitrary string", () => {
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
    // Required fields: stakeAmount, stakeAmountSmallest, tokenMint, txSignature, duelId
    const validBase = {
        stakeAmount: 1.5,
        stakeAmountSmallest: 1500000,
        tokenMint: "So11111111111111111111111111111111111111112",
        txSignature: "5J9pQkNx2YHzLmVwRtKsAeBfCdGiJoMqPrSuTvWxYz",
        duelId: "550e8400-e29b-41d4-a716-446655440000",
    };

    it("accepts valid input with all required fields", () => {
        expect(createDuelSchema.safeParse(validBase).success).toBe(true);
    });

    it("rejects zero or negative stake amount", () => {
        expect(createDuelSchema.safeParse({ ...validBase, stakeAmount: 0 }).success).toBe(false);
        expect(createDuelSchema.safeParse({ ...validBase, stakeAmount: -1 }).success).toBe(false);
    });

    it("rejects missing tokenMint", () => {
        const { tokenMint: _, ...rest } = validBase;
        expect(createDuelSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects missing txSignature", () => {
        const { txSignature: _, ...rest } = validBase;
        expect(createDuelSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects missing duelId", () => {
        const { duelId: _, ...rest } = validBase;
        expect(createDuelSchema.safeParse(rest).success).toBe(false);
    });

    it("rejects non-integer stakeAmountSmallest", () => {
        expect(createDuelSchema.safeParse({ ...validBase, stakeAmountSmallest: 1.5 }).success).toBe(false);
    });

    it("rejects invalid gameId (non-UUID)", () => {
        const result = createDuelSchema.safeParse({ ...validBase, gameId: "not-a-uuid" });
        expect(result.success).toBe(false);
    });

    it("accepts optional UUID gameId", () => {
        const result = createDuelSchema.safeParse({ ...validBase, gameId: "550e8400-e29b-41d4-a716-446655440000" });
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

// ─── Game Profile Validators ──────────────────────────────────────────────────

describe("linkGameAccountSchema", () => {
  const base = { gameName: "Clash Royale", playerId: "#2YQ8JCRUG" };

  it("accepts valid input with both verification fields", () => {
    const result = linkGameAccountSchema.safeParse({
      ...base,
      claimedWins: 150,
      claimedChallengeMaxWins: 12,
    });
    expect(result.success).toBe(true);
  });

  it("accepts input omitting both verification fields (optional at schema level)", () => {
    expect(linkGameAccountSchema.safeParse(base).success).toBe(true);
  });

  it("rejects missing gameName", () => {
    expect(linkGameAccountSchema.safeParse({ playerId: "#2YQ8JCRUG" }).success).toBe(false);
  });

  it("rejects missing playerId", () => {
    expect(linkGameAccountSchema.safeParse({ gameName: "Clash Royale" }).success).toBe(false);
  });

  it("rejects negative claimedWins", () => {
    expect(linkGameAccountSchema.safeParse({ ...base, claimedWins: -1 }).success).toBe(false);
  });

  it("rejects float claimedWins", () => {
    expect(linkGameAccountSchema.safeParse({ ...base, claimedWins: 150.5 }).success).toBe(false);
  });

  it("rejects negative claimedChallengeMaxWins", () => {
    expect(linkGameAccountSchema.safeParse({ ...base, claimedChallengeMaxWins: -1 }).success).toBe(false);
  });

  it("rejects float claimedChallengeMaxWins", () => {
    expect(linkGameAccountSchema.safeParse({ ...base, claimedChallengeMaxWins: 11.9 }).success).toBe(false);
  });

  it("accepts zero for both verification fields (valid edge case)", () => {
    const result = linkGameAccountSchema.safeParse({
      ...base,
      claimedWins: 0,
      claimedChallengeMaxWins: 0,
    });
    expect(result.success).toBe(true);
  });
});
