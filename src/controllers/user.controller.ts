import { Context } from "hono";
import {
    createPlayer,
    getPlayerProfile,
    updatePlayerPfp,
} from "../services/user.service";

export async function createPlayerHandler(c: Context) {
    try {
        const { username, walletKey, pfp } = await c.req.json();

        if (!username || !walletKey) {
            return c.json({ error: "Missing required fields: username, walletKey" }, 400);
        }

        const player = await createPlayer(username, walletKey, pfp);
        return c.json({ player }, 201);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create player";
        return c.json({ error: message }, 400);
    }
}

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

export async function updatePfpHandler(c: Context) {
    try {
        const username = c.req.param("username");
        const { pfp } = await c.req.json();

        if (!pfp) {
            return c.json({ error: "Missing required field: pfp" }, 400);
        }

        const player = await updatePlayerPfp(username, pfp);
        return c.json({ player }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update pfp";
        return c.json({ error: message }, 400);
    }
}
