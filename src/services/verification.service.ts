import { db } from "../db";
import { duels, gameProfiles, matches } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { recordWin, recordLoss } from "./user.service";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VerificationResult {
    duelId: string;
    verified: boolean;
    winnerUsername: string | null;
    reason: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Attempts to verify a DISPUTED duel by comparing the most-recent match records
 * attached to each player's game profile for the duel's game.
 *
 * Strategy:
 *  1. Look up the game profile for each player (via gameProfiles).
 *  2. Check their latest match record (via matches).
 *  3. Whoever has `won = true` in their most recent match is declared winner.
 *  4. If neither or both won, the dispute cannot be auto-resolved.
 */
export async function verifyDisputedDuel(duelId: string): Promise<VerificationResult> {
    const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));

    if (!duel) {
        return { duelId, verified: false, winnerUsername: null, reason: "Duel not found" };
    }
    if (duel.status !== "DISPUTED") {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: `Duel is not in DISPUTED state (current: ${duel.status})`,
        };
    }
    if (!duel.gameId || !duel.player1Id || !duel.player2Id) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: "Duel is missing gameId or player references — cannot auto-verify",
        };
    }

    // Fetch game profiles
    const [profile1] = await db
        .select()
        .from(gameProfiles)
        .where(
            and(
                eq(gameProfiles.userId, duel.player1Id),
                eq(gameProfiles.gameId, duel.gameId)
            )
        );

    const [profile2] = await db
        .select()
        .from(gameProfiles)
        .where(
            and(
                eq(gameProfiles.userId, duel.player2Id),
                eq(gameProfiles.gameId, duel.gameId)
            )
        );

    if (!profile1 || !profile2) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: "One or both players have no game profile for this game",
        };
    }

    // Fetch latest match record for each profile
    const [match1] = await db
        .select()
        .from(matches)
        .where(eq(matches.gameprofileId, profile1.id));

    const [match2] = await db
        .select()
        .from(matches)
        .where(eq(matches.gameprofileId, profile2.id));

    const p1Won = match1?.won ?? false;
    const p2Won = match2?.won ?? false;

    if (p1Won && !p2Won) {
        await settleDispute(duelId, duel.player1Username, duel.player1Id, duel.player2Id, duel.stakeAmount);
        return {
            duelId,
            verified: true,
            winnerUsername: duel.player1Username,
            reason: "Player 1 match record shows a win",
        };
    }

    if (p2Won && !p1Won) {
        await settleDispute(duelId, duel.player2Username!, duel.player2Id, duel.player1Id, duel.stakeAmount);
        return {
            duelId,
            verified: true,
            winnerUsername: duel.player2Username,
            reason: "Player 2 match record shows a win",
        };
    }

    return {
        duelId,
        verified: false,
        winnerUsername: null,
        reason: "Cannot determine winner from match records — manual review required",
    };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function settleDispute(
    duelId: string,
    winnerUsername: string,
    winnerId: string,
    loserId: string,
    stakeAmount: number
): Promise<void> {
    await db
        .update(duels)
        .set({ status: "SETTLED", winnerUsername, winnerId })
        .where(eq(duels.id, duelId));

    await recordWin(winnerId, stakeAmount);
    await recordLoss(loserId, stakeAmount);
}
