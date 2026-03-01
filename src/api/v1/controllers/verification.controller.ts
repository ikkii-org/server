import { Context } from "hono";
import { verifyDisputedDuel } from "../services/verification.service";

export async function verifyDuelHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const result = await verifyDisputedDuel(duelId);

        const status = result.verified ? 200 : 422;
        return c.json({ result }, status);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to verify duel";
        return c.json({ error: message }, 500);
    }
}
