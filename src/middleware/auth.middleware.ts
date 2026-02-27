import type { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { env } from "../config/env";

export async function authMiddleware(
  c: Context,
  next: Next,
): Promise<Response | void> {
  let userId: string | undefined;
  let username: string | undefined;

  const session = c.get("session");
  if (session) {
    const sessionData = session.get();
    if (sessionData) {
      userId = sessionData.userId;
      username = sessionData.username;
    }
  }

  if (!userId || !username) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verify(token, env.JWT_SECRET, "HS256");

      if (!payload.sub || !payload.username) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      userId = payload.sub as string;
      username = payload.username as string;
    } catch {
      return c.json({ error: "Unauthorized" }, 401);
    }
  }

  c.set("userId", userId);
  c.set("username", username);
  await next();
}
