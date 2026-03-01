import { Hono } from "hono";
import { authMiddleware } from "../../middleware/auth.middleware";
import { healthRoutes } from "./routes/health.routes";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/user.routes";
import { duelRoutes } from "./routes/duel.routes";
import { escrowRoutes } from "./routes/escrow.routes";
import { leaderboardRoutes } from "./routes/leaderboard.routes";
import { verificationRoutes } from "./routes/verification.routes";

export const v1Router = new Hono();

// ─── Public routes ────────────────────────────────────────────────────────────
v1Router.route("/health", healthRoutes);
v1Router.route("/auth", authRoutes);

// ─── Protected routes ─────────────────────────────────────────────────────────
v1Router.use("/users/*", authMiddleware);
v1Router.use("/duels/*", authMiddleware);
v1Router.use("/escrow/*", authMiddleware);
v1Router.use("/leaderboard/*", authMiddleware);
v1Router.use("/verification/*", authMiddleware);

v1Router.route("/users", userRoutes);
v1Router.route("/duels", duelRoutes);
v1Router.route("/escrow", escrowRoutes);
v1Router.route("/leaderboard", leaderboardRoutes);
v1Router.route("/verification", verificationRoutes);
