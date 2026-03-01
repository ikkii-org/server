import type { Context, Next } from "hono";
import { env } from "../config/env";

/** Guards endpoints that should only be callable by trusted internal services.
 *  Requires a matching X-Admin-Secret header. If ADMIN_SECRET is not configured
 *  the endpoint is disabled entirely. */
export async function adminMiddleware(c: Context, next: Next): Promise<Response | void> {
    if (!env.ADMIN_SECRET) {
        return c.json({ error: "Admin endpoints are disabled" }, 403);
    }

    const secret = c.req.header("X-Admin-Secret");
    if (!secret || secret !== env.ADMIN_SECRET) {
        return c.json({ error: "Forbidden" }, 403);
    }

    await next();
}
