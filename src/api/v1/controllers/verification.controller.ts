import { Context } from "hono";
import { verifyDisputedDuel } from "../services/verification.service";

export async function verifyDuelHandler(c: Context) {
    try {
        const duelId = c.req.param("id");
        const result = await verifyDisputedDuel(duelId);

        // Always return 200 — the `verified` boolean tells the client whether
        // auto-resolution succeeded. Returning 422 for "not verified" caused
        // the mobile apiFetch to throw and show a generic error toast.
        return c.json({ result }, 200);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to verify duel";
        return c.json({ error: message }, 500);
    }
}
