import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env } from "./config/env";

import { authMiddleware } from "./middleware/auth.middleware";
import * as Sentry from "@sentry/node";
import { healthRoutes } from "./routes/health.routes";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/user.routes";
import { duelRoutes } from "./routes/duel.routes";
import { escrowRoutes } from "./routes/escrow.routes";
import { leaderboardRoutes } from "./routes/leaderboard.routes";
import { verificationRoutes } from "./routes/verification.routes";
import { HTTPException } from "hono/http-exception";

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

// ─── Public routes (no auth) ──────────────────────────────────────────────────
app.route("/health", healthRoutes);
app.route("/auth", authRoutes);

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use("/users/*", authMiddleware);
app.use("/duels/*", authMiddleware);
app.use("/escrow/*", authMiddleware);
app.use("/leaderboard/*", authMiddleware);
app.use("/verification/*", authMiddleware);

app.route("/users", userRoutes);
app.route("/duels", duelRoutes);
app.route("/escrow", escrowRoutes);
app.route("/leaderboard", leaderboardRoutes);
app.route("/verification", verificationRoutes);
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
