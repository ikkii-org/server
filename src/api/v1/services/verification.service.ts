import { db } from "../../../db";
import { duels, games, gameProfiles, users } from "../../../db/schema";
import { eq, and } from "drizzle-orm";
import { recordWin, recordLoss } from "./user.service";
import { resolveDisputeOnChain } from "./onchain.service";
import { verifyMatchBetweenPlayers } from "./clash-royale.service";
import { env } from "../../../config/env";
import { publish, CHANNELS } from "../../../services/pubsub.service";
import type { VerificationResult } from "../models/verification.model";

export type { VerificationResult };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get API key for a game from environment variables.
 */
function getApiKeyForGame(gameName: string | undefined): string | null {
    if (!gameName) return null;

    switch (gameName.toLowerCase()) {
        case "clash royale":
            return env.CLASH_ROYALE_TOKEN || null;
        default:
            return null;
    }
}

/**
 * Attempts to verify a DISPUTED duel by calling the game's external API
 * to check match results between the two players.
 *
 * Strategy:
 *  1. Look up the duel's game and each player's game profile (player tag).
 *  2. Call the game's battle log API to find a recent 1v1 match between them.
 *  3. If a match is found with a clear winner, settle the dispute on-chain.
 *  4. If no match is found, or the API is unavailable, return unverified.
 */
export async function verifyDisputedDuel(duelId: string): Promise<VerificationResult> {
    const tag = `[verifyDisputedDuel][${duelId}]`;

    // ── 1. Load and validate the duel ────────────────────────────────────
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
    if (!duel.gameId) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: "Duel has no associated game — cannot auto-verify",
        };
    }
    if (!duel.player1Id || !duel.player2Id) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: "Duel is missing player references — cannot auto-verify",
        };
    }

    // ── 2. Load game info and API key ────────────────────────────────────
    const [game] = await db.select().from(games).where(eq(games.id, duel.gameId));

    if (!game) {
        return { duelId, verified: false, winnerUsername: null, reason: "Game not found in database" };
    }
    if (!game.apiBaseUrl) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: `Game "${game.name}" has no API base URL configured`,
        };
    }

    const apiKey = getApiKeyForGame(game.name);
    if (!apiKey) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: `No API key configured for game "${game.name}" — set the environment variable`,
        };
    }

    // ── 3. Load game profiles for both players ───────────────────────────
    const [profile1] = await db
        .select()
        .from(gameProfiles)
        .where(
            and(
                eq(gameProfiles.userId, duel.player1Id),
                eq(gameProfiles.gameId, duel.gameId),
            ),
        );

    const [profile2] = await db
        .select()
        .from(gameProfiles)
        .where(
            and(
                eq(gameProfiles.userId, duel.player2Id),
                eq(gameProfiles.gameId, duel.gameId),
            ),
        );

    if (!profile1?.playerId || !profile2?.playerId) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: "One or both players have no linked game profile (missing player tag)",
        };
    }

    // ── 4. Call the game API to verify the match ─────────────────────────
    console.log(
        `${tag} Calling ${game.name} API to verify match between ` +
        `"${profile1.playerId}" and "${profile2.playerId}"`,
    );

    let result: { verified: boolean; winner: string | null; reason: string };
    try {
        if (game.name.toLowerCase() === "clash royale") {
            result = await verifyMatchBetweenPlayers(
                game.apiBaseUrl,
                apiKey,
                profile1.playerId,
                profile2.playerId,
                60, // check matches within last 60 minutes
            );
        } else {
            return {
                duelId,
                verified: false,
                winnerUsername: null,
                reason: `No verification integration for game "${game.name}"`,
            };
        }
    } catch (apiErr) {
        console.error(`${tag} Game API call failed:`, apiErr);
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: `Game API error: ${apiErr instanceof Error ? apiErr.message : String(apiErr)}`,
        };
    }

    console.log(`${tag} API result: verified=${result.verified}, winner=${result.winner}, reason=${result.reason}`);

    if (!result.verified || !result.winner) {
        return {
            duelId,
            verified: false,
            winnerUsername: null,
            reason: result.reason,
        };
    }

    // ── 5. Map the winning player tag back to a username ─────────────────
    const winnerTag = result.winner;
    const winnerProfile = winnerTag === profile1.playerId ? profile1 : profile2;
    const loserProfile = winnerTag === profile1.playerId ? profile2 : profile1;

    const winnerId = winnerProfile === profile1 ? duel.player1Id : duel.player2Id;
    const loserId = loserProfile === profile1 ? duel.player1Id : duel.player2Id;
    const winnerUsername = winnerProfile === profile1 ? duel.player1Username : duel.player2Username!;

    console.log(`${tag} Verified winner: "${winnerUsername}" (tag: ${winnerTag})`);

    // ── 6. Settle the dispute ────────────────────────────────────────────
    await settleDispute(duelId, winnerUsername, winnerId, loserId, duel.stakeAmount, duel.tokenMint);

    return {
        duelId,
        verified: true,
        winnerUsername,
        reason: result.reason,
    };
}

// ─── Internal ─────────────────────────────────────────────────────────────────

async function settleDispute(
    duelId: string,
    winnerUsername: string,
    winnerId: string,
    loserId: string,
    stakeAmount: number,
    tokenMint: string,
): Promise<void> {
    const tag = `[settleDispute][${duelId}]`;

    // Fetch the winner's wallet key for on-chain settlement
    const [winner] = await db
        .select({ walletKey: users.walletKey })
        .from(users)
        .where(eq(users.id, winnerId));

    // Settle on-chain first — release escrow funds to the winner
    let settleTxSig: string | null = null;
    if (winner?.walletKey) {
        try {
            settleTxSig = await resolveDisputeOnChain(duelId, winner.walletKey, tokenMint);
            console.log(`${tag} On-chain resolve succeeded: ${settleTxSig}`);
        } catch (err) {
            console.error(`${tag} On-chain resolve failed:`, err);
            // Do NOT propagate — still mark settled in DB so admin can manually recover
        }
    } else {
        console.error(`${tag} Winner has no wallet key — cannot settle on-chain`);
    }

    // Update DB
    const [settled] = await db
        .update(duels)
        .set({ status: "SETTLED", winnerUsername, winnerId, txSignature: settleTxSig })
        .where(eq(duels.id, duelId))
        .returning();

    // Publish settlement event
    if (settled) {
        await publish(CHANNELS.DUEL_SETTLED(duelId), "DUEL_SETTLED", settled);
    }

    await recordWin(winnerId, stakeAmount);
    await recordLoss(loserId, stakeAmount);

    console.log(`${tag} Dispute settled — winner: "${winnerUsername}"`);
}
