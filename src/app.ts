import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { env } from "./config/env"; // validates JWT_SECRET + DATABASE_URL at startup
import { authMiddleware } from "./middleware/auth.middleware";

import { healthRoutes } from "./routes/health.routes";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/user.routes";
import { duelRoutes } from "./routes/duel.routes";
import { escrowRoutes } from "./routes/escrow.routes";
import { leaderboardRoutes } from "./routes/leaderboard.routes";
import { verificationRoutes } from "./routes/verification.routes";

const app = new Hono();

// ─── Global middlewares ───────────────────────────────────────────────────────
app.use("*", logger());
app.use("*", cors());

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

// ─── Error handlers ───────────────────────────────────────────────────────────
app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
});

export default app;
