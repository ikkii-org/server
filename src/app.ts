import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./config/env";
import * as Sentry from "@sentry/node";
import { HTTPException } from "hono/http-exception";
import { v1Router } from "./api/v1";

const app = new Hono()
  .onError((err, c) => {
    Sentry.captureException(err);
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

// ─── Global middlewares ───────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors(env.ALLOWED_ORIGINS.length > 0 ? { origin: env.ALLOWED_ORIGINS } : undefined));

// ─── API v1 ───────────────────────────────────────────────────────────────────
app.route("/api/v1", v1Router);

if (env.NODE_ENV !== "production") {
  app.get("/debug-sentry", () => {
    throw new Error("My first Sentry error!");
  });
}

// ─── Error handlers ───────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export default app;
