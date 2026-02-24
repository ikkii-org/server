import { Context } from "hono";
import { getPlayerProfile, getPlayerById, updatePlayerPfp } from "../services/user.service";
import { updatePfpSchema } from "../validators/user.validators";

export async function getProfileHandler(c: Context) {
    try {
        const username = c.req.param("username");
        const profile = await getPlayerProfile(username);
        return c.json({ profile }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Player not found";
        return c.json({ error: message }, 404);
    }
}

export async function getPlayerByIdHandler(c: Context) {
    try {
        const userId = c.req.param("id");
        const player = await getPlayerById(userId);
        return c.json({ player }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Player not found";
        return c.json({ error: message }, 404);
    }
}

export async function updatePfpHandler(c: Context) {
    try {
        const username = c.req.param("username");
        const body = await c.req.json();
        const result = updatePfpSchema.safeParse(body);

        if (!result.success) {
            return c.json({ error: result.error.issues[0].message }, 400);
        }

        const player = await updatePlayerPfp(username, result.data.pfp);
        return c.json({ player }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update pfp";
        return c.json({ error: message }, 400);
    }
}
