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

    await c.var.session.update({ userId: signupResult.user.id, username: signupResult.user.username });

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

    await c.var.session.update({ userId: loginResult.user.id, username: loginResult.user.username });

    return c.json(loginResult, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return c.json({ error: message }, 401);
  }
}

export async function logoutHandler(c: Context) {
  c.var.session.delete();
  return c.json({ message: "Logged out" }, 200);
}
