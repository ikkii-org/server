import { hash, verify } from "@node-rs/argon2";
import { sign } from "hono/jwt";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, portfolio, wallet } from "../db/schema";
import { env } from "../config/env";
import type { User } from "../db/schema";

// ─── JWT ─────────────────────────────────────────────────────────────────────

/** Duration in seconds for token expiry — parses "1h", "7d", plain seconds. */
function parseDurationSecs(value: string): number {
  const match = value.match(/^(\d+)([smhd]?)$/);
  if (!match) return 3600; // fallback: 1 hour
  const n = parseInt(match[1], 10);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };
  return n * (multipliers[unit] ?? 1);
}

export async function signToken(
  userId: string,
  username: string,
): Promise<string> {
  const nowSecs = Math.floor(Date.now() / 1000);
  const expSecs = parseDurationSecs(env.JWT_EXPIRES_IN);

  return sign(
    { sub: userId, username, iat: nowSecs, exp: nowSecs + expSecs },
    env.JWT_SECRET,
  );
}

// ─── Signup ───────────────────────────────────────────────────────────────────

export interface AuthResult {
  token: string;
  user: Omit<User, "passwordHash">;
}

export async function signup(
  username: string,
  walletKey: string,
  password: string,
  pfp?: string,
): Promise<AuthResult> {
  if (!username) throw new Error("Username is required");
  if (!walletKey) throw new Error("Wallet key is required");
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  // Check uniqueness before hashing (saves CPU on duplicates)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username));
  if (existing) throw new Error("Username already taken");

  const passwordHash = await hash(password);

  const [user] = await db
    .insert(users)
    .values({ username, walletKey, passwordHash, pfp: pfp ?? null })
    .returning();

  // Bootstrap linked tables
  await db.insert(portfolio).values({ userId: user.id }).onConflictDoNothing();
  await db
    .insert(wallet)
    .values({
      userId: user.id,
      token: walletKey,
      availableBalance: "0",
      lockedBalance: "0",
    })
    .onConflictDoNothing();

  const token = await signToken(user.id, user.username);
  const { passwordHash: _, ...safeUser } = user;
  return { token, user: safeUser };
}

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(
  username: string,
  password: string,
): Promise<AuthResult> {
  if (!username) throw new Error("Username is required");
  if (!password) throw new Error("Password is required");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));

  if (!user) throw new Error("Invalid username or password");
  if (!user.passwordHash)
    throw new Error("Account has no password set — use wallet auth");

  const valid = await verify(user.passwordHash, password);
  if (!valid) throw new Error("Invalid username or password");

  const token = await signToken(user.id, user.username);
  const { passwordHash: _, ...safeUser } = user;
  return { token, user: safeUser };
}
