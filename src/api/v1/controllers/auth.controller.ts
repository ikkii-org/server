import { Context } from "hono";
import { signup, login } from "../services/auth.service";
import { signupSchema, loginSchema } from "../validators/auth.validators";

export async function signupHandler(c: Context) {
  try {
    const body = await c.req.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return c.json({ error: result.error.issues[0].message }, 400);
    }

    const { username, walletKey, password, pfp } = result.data;
    const signupResult = await signup(username, walletKey, password, pfp);

    return c.json(signupResult, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed";
    return c.json({ error: message }, 400);
  }
}

export async function loginHandler(c: Context) {
  try {
    const body = await c.req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return c.json({ error: result.error.issues[0].message }, 400);
    }

    const { username, password } = result.data;
    const loginResult = await login(username, password);

    return c.json(loginResult, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return c.json({ error: message }, 401);
  }
}

export async function logoutHandler(c: Context) {
  // JWT is stateless — clients should discard the token on their end.
  return c.json({ message: "Logged out" }, 200);
}
