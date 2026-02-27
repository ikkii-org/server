import { Context } from "hono";
import { signup, login } from "../services/auth.service";

export async function signupHandler(c: Context) {
  try {
    const { username, walletKey, password, pfp } = await c.req.json();

    if (!username || !walletKey || !password) {
      return c.json(
        { error: "Missing required fields: username, walletKey, password" },
        400,
      );
    }

    const result = await signup(username, walletKey, password, pfp);

    const session = c.get("session");
    session.set({ userId: result.user.id, username: result.user.username });

    return c.json(result, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    return c.json({ error: message }, 400);
  }
}

export async function loginHandler(c: Context) {
  try {
    const { username, password } = await c.req.json();

    if (!username || !password) {
      return c.json(
        { error: "Missing required fields: username, password" },
        400,
      );
    }

    const result = await login(username, password);

    const session = c.get("session");
    session.set({ userId: result.user.id, username: result.user.username });

    return c.json(result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return c.json({ error: message }, 401);
  }
}

export async function logoutHandler(c: Context) {
  const session = c.get("session");
  session.delete();
  return c.json({ message: "Logged out" }, 200);
}
