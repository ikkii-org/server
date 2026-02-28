import { Context, Hono, Next } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { useSession } from "@hono/session";
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
    // Report _all_ unhandled errors.
    Sentry.captureException(err);
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    // Or just report errors which are not instances of HTTPException
    // Sentry.captureException(err);
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
  })
  .use(async (c: Context, next: Next) => {
    // Only set user context if session exists and has user data
    const sessionData = await c.var.session?.get();
    if (sessionData?.username) {
      Sentry.setUser({
        username: sessionData.username,
      });
    }

    return next();
  });

// ─── Global middlewares ───────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors());
app.use(
  "*",
  useSession({
    secret: env.COOKIE_SECRET,
    duration: { absolute: 60 * 60 * 24 }, // 24 hours in seconds
  }),
);

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
app.get("/debug-sentry", () => {
  throw new Error("My first Sentry error!");
});
// ─── Error handlers ───────────────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

export default app;
