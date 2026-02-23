import { Context } from "hono";
import { getPlayerProfile, getPlayerById, updatePlayerPfp } from "../services/user.service";

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
        const { pfp } = await c.req.json();

        if (!pfp) return c.json({ error: "Missing required field: pfp" }, 400);

        const player = await updatePlayerPfp(username, pfp);
        return c.json({ player }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update pfp";
        return c.json({ error: message }, 400);
    }
}
