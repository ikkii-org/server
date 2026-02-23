import type { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { env } from "../config/env";

export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
    const authHeader = c.req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.slice(7); // strip "Bearer "

    try {
        const payload = await verify(token, env.JWT_SECRET, "HS256");

        if (!payload.sub || !payload.username) {
            return c.json({ error: "Unauthorized" }, 401);
        }

        // Attach caller identity to context for downstream handlers
        c.set("userId", payload.sub as string);
        c.set("username", payload.username as string);

        await next();
    } catch {
        return c.json({ error: "Unauthorized" }, 401);
    }
}
