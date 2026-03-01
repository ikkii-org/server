import { Hono } from "hono";
import { signupHandler, loginHandler, logoutHandler } from "../controllers/auth.controller";
import { authMiddleware } from "../../../middleware/auth.middleware";
import { rateLimit } from "../../../middleware/rate-limit.middleware";

export const authRoutes = new Hono();

// 10 requests per minute per IP on auth endpoints
const authRateLimit = rateLimit({ limit: 10, windowMs: 60_000 });

// POST /auth/signup — register a new player
// Body: { username, walletKey, password, pfp? }
authRoutes.post("/signup", authRateLimit, signupHandler);

// POST /auth/login  — authenticate and get a JWT
// Body: { username, password }
authRoutes.post("/login", authRateLimit, loginHandler);

// POST /auth/logout — destroy client token (stateless, JWT)
authRoutes.post("/logout", authMiddleware, logoutHandler);

