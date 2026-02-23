import { Hono } from "hono";
import { signupHandler, loginHandler } from "../controllers/auth.controller";

export const authRoutes = new Hono();

// POST /auth/signup — register a new player
// Body: { username, walletKey, password, pfp? }
authRoutes.post("/signup", signupHandler);

// POST /auth/login  — authenticate and get a JWT
// Body: { username, password }
authRoutes.post("/login", loginHandler);
