import { describe, it, expect } from "bun:test";
import { Hono } from "hono";
import { rateLimit } from "../middleware/rate-limit.middleware";

function buildApp(limit: number, windowMs: number) {
    const app = new Hono();
    app.get("/test", rateLimit({ limit, windowMs }), (c) => c.json({ ok: true }));
    return app;
}

function fakeRequest(app: Hono, ip = "1.2.3.4") {
    return app.request("/test", {
        headers: { "x-forwarded-for": ip },
    });
}

describe("rateLimit middleware", () => {
    it("allows requests under the limit", async () => {
        const app = buildApp(5, 60_000);
        for (let i = 0; i < 5; i++) {
            const res = await fakeRequest(app);
            expect(res.status).toBe(200);
        }
    });

    it("blocks requests over the limit with 429", async () => {
        const app = buildApp(3, 60_000);
        for (let i = 0; i < 3; i++) {
            await fakeRequest(app);
        }
        const res = await fakeRequest(app);
        expect(res.status).toBe(429);
        const body = await res.json();
        expect(body.error).toContain("Too many requests");
    });

    it("sets X-RateLimit-Limit and X-RateLimit-Remaining headers", async () => {
        const app = buildApp(10, 60_000);
        const res = await fakeRequest(app);
        expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
        expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
    });

    it("tracks limits per IP independently", async () => {
        const app = buildApp(2, 60_000);
        // Exhaust IP A
        await fakeRequest(app, "10.0.0.1");
        await fakeRequest(app, "10.0.0.1");
        const blockedA = await fakeRequest(app, "10.0.0.1");
        expect(blockedA.status).toBe(429);

        // IP B should still be allowed
        const allowedB = await fakeRequest(app, "10.0.0.2");
        expect(allowedB.status).toBe(200);
    });
});
