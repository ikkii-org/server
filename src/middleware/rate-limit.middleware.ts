import type { Context, Next } from "hono";

interface RateLimitOptions {
    /** Maximum number of requests allowed within the window. */
    limit: number;
    /** Window duration in milliseconds. */
    windowMs: number;
}

/** Simple in-memory sliding-window rate limiter keyed by client IP. */
export function rateLimit(opts: RateLimitOptions) {
    const { limit, windowMs } = opts;
    // Map<ip, timestamps[]>
    const hits = new Map<string, number[]>();

    return async (c: Context, next: Next): Promise<Response | void> => {
        const ip =
            c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
            c.req.header("cf-connecting-ip") ??
            "unknown";

        const now = Date.now();
        const windowStart = now - windowMs;

        const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);
        timestamps.push(now);
        hits.set(ip, timestamps);

        c.header("X-RateLimit-Limit", String(limit));
        c.header("X-RateLimit-Remaining", String(Math.max(0, limit - timestamps.length)));

        if (timestamps.length > limit) {
            return c.json({ error: "Too many requests, please try again later." }, 429);
        }

        await next();
    };
}
