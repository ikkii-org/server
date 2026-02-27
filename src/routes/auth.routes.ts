import { Hono } from "hono";
import { signupHandler, loginHandler, logoutHandler } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth.middleware";

export const authRoutes = new Hono();

// POST /auth/signup — register a new player
// Body: { username, walletKey, password, pfp? }
authRoutes.post("/signup", signupHandler);

// POST /auth/login  — authenticate and get a JWT
// Body: { username, password }
authRoutes.post("/login", loginHandler);

// POST /auth/logout — logout and destroy session
authRoutes.post("/logout", authMiddleware, logoutHandler);
