import { Context } from "hono";
import { getPlayerProfile, getPlayerById, updatePlayerPfp } from "../services/user.service";
import { updatePfpSchema, usernameSchema, userIdSchema } from "../validators/user.validators";

export async function getProfileHandler(c: Context) {
    try {
        const username = c.req.param("username");
        const result = usernameSchema.safeParse(username);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const profile = await getPlayerProfile(result.data);
        return c.json({ profile }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Player not found";
        return c.json({ error: message }, 404);
    }
}

export async function getPlayerByIdHandler(c: Context) {
    try {
        const userId = c.req.param("id");
        const result = userIdSchema.safeParse(userId);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const player = await getPlayerById(String(result.data));
        return c.json({ player }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Player not found";
        return c.json({ error: message }, 404);
    }
}

export async function updatePfpHandler(c: Context) {
    try {
        const username = c.req.param("username");
        const usernameResult = usernameSchema.safeParse(username);

        if (!usernameResult.success) {
            return c.json({ error: usernameResult.error.issues[0].message }, 400);
        }

        const body = await c.req.json();
        const bodyResult = updatePfpSchema.safeParse(body);

        if (!bodyResult.success) {
            return c.json({ error: bodyResult.error.issues[0].message }, 400);
        }

        const player = await updatePlayerPfp(usernameResult.data, bodyResult.data.pfp);
        return c.json({ player }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update pfp";
        return c.json({ error: message }, 400);
    }
}
