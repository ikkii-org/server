import { db } from "../../../db";
import { duels, users, games, gameProfiles } from "../../../db/schema";
import { eq, and, lt, sql, desc } from "drizzle-orm";
import type { DuelStatus } from "../types/duel.types";
import type { Duel, DuelSubmitResult } from "../models/duel.model";
import { publish, CHANNELS } from "../../../services/pubsub.service";
import { env } from "../../../config/env";
import {
    settleOnChain,
    disputeOnChain,
    resolveDisputeOnChain,
    verifyWinnerViaGameApi,
    verifyCreateEscrowTx,
    verifyJoinEscrowTx,
    verifyCancelEscrowTx,
} from "./onchain.service";

export type { Duel, DuelSubmitResult };

// Infer the row type directly from the schema
type DuelRow = typeof duels.$inferSelect;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapRow(row: DuelRow): Duel {
    return {
        id: row.id,
        player1Id: row.player1Id,
        player1Username: row.player1Username,
        player2Id: row.player2Id ?? null,
        player2Username: row.player2Username ?? null,
        stakeAmount: row.stakeAmount,
        tokenMint: row.tokenMint,
        status: row.status as DuelStatus,
        winnerUsername: row.winnerUsername ?? null,
        winnerId: row.winnerId ?? null,
        player1SubmittedWinner: row.player1SubmittedWinner ?? null,
        player2SubmittedWinner: row.player2SubmittedWinner ?? null,
        gameId: row.gameId ?? null,
        player1GameProfileId: row.player1GameProfileId ?? null,
        player2GameProfileId: row.player2GameProfileId ?? null,
        txSignature: row.txSignature ?? null,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
    };
}

async function requireUser(username: string) {
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));

    if (!user) throw new Error(`User '${username}' not found`);
    return user;
}

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

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Create a new open duel.
 * @param player1Username - username of the creator
 * @param stakeAmount     - amount to stake
 * @param tokenMint       - SPL token mint address
 * @param gameId          - optional game UUID to associate
 * @param expiresInMs     - milliseconds until the duel expires (default 30 min)
 */
export async function createDuel(
    player1Username: string,
    stakeAmount: number,
    stakeAmountSmallest: number,
    tokenMint: string,
    gameId?: string,
    expiresInMs: number = 30 * 60 * 1000,
    txSignature?: string,
    duelId?: string,
): Promise<Duel> {
    if (!player1Username) throw new Error("Player username is required");
    if (stakeAmount <= 0) throw new Error("Stake amount must be greater than 0");
    if (!tokenMint) throw new Error("Token mint is required");
    if (!txSignature) throw new Error("Transaction signature is required for on-chain verification");
    if (!duelId) throw new Error("Duel ID is required from the frontend");

    // 1. Verify the Escrow Creation transaction on-chain
    const isValidTx = await verifyCreateEscrowTx(txSignature, duelId, stakeAmountSmallest);
    if (!isValidTx) {
        throw new Error("Invalid or unverified transaction signature");
    }

    const player1 = await requireUser(player1Username);

    // Look up the player's game profile if a gameId is provided
    let player1GameProfileId: string | null = null;
    if (gameId) {
        const [profile] = await db
            .select()
            .from(gameProfiles)
            .where(
                and(
                    eq(gameProfiles.userId, player1.id),
                    eq(gameProfiles.gameId, gameId),
                ),
            );
        if (profile) {
            player1GameProfileId = profile.id;
        }
    }

    const [duel] = await db
        .insert(duels)
        .values({
            id: duelId,
            player1Id: player1.id,
            player1Username: player1.username,
            player2Id: null,
            player2Username: null,
            stakeAmount,
            tokenMint,
            status: "OPEN",
            txSignature,
            gameId: gameId ?? null,
            player1GameProfileId,
            expiresAt: new Date(Date.now() + expiresInMs),
        })
        .returning();

    const mapped = mapRow(duel);

    // Publish event so all WebSocket clients see the new duel
    await publish(CHANNELS.DUEL_CREATED, "DUEL_CREATED", mapped);

    return mapped;
}

/**
 * Join an existing open duel as player 2.
 */
export async function joinDuel(
    duelId: string,
    player2Username: string,
    txSignature?: string
): Promise<Duel> {
    const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "OPEN") throw new Error("Duel is not open for joining");
    if (duel.player1Username === player2Username) throw new Error("Player cannot join their own duel");
    if (duel.expiresAt < new Date()) throw new Error("Duel has expired");
    if (!txSignature) throw new Error("Transaction signature is required for on-chain verification");

    // 1. Verify the Join Escrow transaction on-chain (with PDA check)
    const isValidTx = await verifyJoinEscrowTx(txSignature, duelId);
    if (!isValidTx) {
        throw new Error("Invalid or unverified transaction signature");
    }

    const player2 = await requireUser(player2Username);

    // Look up player 2's game profile if the duel has a gameId
    let player2GameProfileId: string | null = null;
    if (duel.gameId) {
        const [profile] = await db
            .select()
            .from(gameProfiles)
            .where(
                and(
                    eq(gameProfiles.userId, player2.id),
                    eq(gameProfiles.gameId, duel.gameId),
                ),
            );
        if (profile) {
            player2GameProfileId = profile.id;
        }
    }

    const [updated] = await db
        .update(duels)
        .set({
            player2Id: player2.id,
            player2Username: player2.username,
            player2GameProfileId,
            status: "ACTIVE",
        })
        .where(eq(duels.id, duelId))
        .returning();

    const mapped = mapRow(updated);

    // Publish to anyone watching this specific duel
    await publish(CHANNELS.DUEL_JOINED(duelId), "DUEL_JOINED", mapped);

    return mapped;
}

/**
 * Submit a result claim. Once both players agree the duel is SETTLED;
 * if they disagree it becomes DISPUTED.
 */
export async function submitResult(
    duelId: string,
    username: string,
    claimedWinnerUsername: string
): Promise<DuelSubmitResult> {
    const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "ACTIVE") throw new Error("Duel is not active");
    if (username !== duel.player1Username && username !== duel.player2Username) {
        throw new Error("Only participants can submit results");
    }
    if (
        claimedWinnerUsername !== duel.player1Username &&
        claimedWinnerUsername !== duel.player2Username
    ) {
        throw new Error("Winner must be one of the duel participants");
    }

    const update: Partial<typeof duels.$inferInsert> = {};

    if (username === duel.player1Username) {
        if (duel.player1SubmittedWinner) throw new Error("Player 1 has already submitted a result");
        update.player1SubmittedWinner = claimedWinnerUsername;
    } else {
        if (duel.player2SubmittedWinner) throw new Error("Player 2 has already submitted a result");
        update.player2SubmittedWinner = claimedWinnerUsername;
    }

    const [updated] = await db
        .update(duels)
        .set(update)
        .where(eq(duels.id, duelId))
        .returning();

    // Both players submitted — resolve
    if (updated.player1SubmittedWinner && updated.player2SubmittedWinner) {
        if (updated.player1SubmittedWinner === updated.player2SubmittedWinner) {
            // Consensus → settle on-chain first, then update DB
            const winnerUsername = updated.player1SubmittedWinner;
            const winner = await requireUser(winnerUsername);
            const loserUsername =
                winnerUsername === updated.player1Username
                    ? updated.player2Username!
                    : updated.player1Username;
            const loser = await requireUser(loserUsername);

            // On-chain settlement (authority signs)
            let txSignature: string | null = null;
            try {
                txSignature = await settleOnChain(duelId, winner.walletKey, updated.tokenMint);
            } catch (err) {
                console.error(`On-chain settle failed for duel ${duelId}:`, err);
                // Mark as DISPUTED so the admin dispute-resolution path can recover funds.
                // Both players agreed, so this is a technical failure, not a real dispute.
                const [failedRow] = await db
                    .update(duels)
                    .set({ status: "DISPUTED" })
                    .where(eq(duels.id, duelId))
                    .returning();
                await publish(CHANNELS.DUEL_DISPUTED(duelId), "DUEL_DISPUTED", mapRow(failedRow));
                throw new Error("On-chain settlement failed — duel moved to DISPUTED for admin recovery.");
            }

            const settled = await db.transaction(async (tx) => {
                const [row] = await tx
                    .update(duels)
                    .set({ winnerUsername, winnerId: winner.id, status: "SETTLED", txSignature })
                    .where(eq(duels.id, duelId))
                    .returning();

                await tx.update(users).set({ wins: sql`${users.wins} + 1`, updatedAt: new Date() }).where(eq(users.id, winner.id));
                await tx.update(users).set({ losses: sql`${users.losses} + 1`, updatedAt: new Date() }).where(eq(users.id, loser.id));

                return row;
            });

            const settledMapped = mapRow(settled);

            // Publish settlement event
            await publish(CHANNELS.DUEL_SETTLED(duelId), "DUEL_SETTLED", settledMapped);

            return { duel: settledMapped, resolved: true };
        } else {
            // Dispute — mark on-chain, then attempt game API auto-resolution
            let disputeTxSig: string | null = null;
            try {
                disputeTxSig = await disputeOnChain(duelId);
            } catch (err) {
                console.error(`On-chain dispute failed for duel ${duelId}:`, err);
                throw new Error("On-chain dispute marking failed.");
            }

            const [disputed] = await db
                .update(duels)
                .set({ status: "DISPUTED", txSignature: disputeTxSig })
                .where(eq(duels.id, duelId))
                .returning();

            const disputedMapped = mapRow(disputed);

            // Publish dispute event
            await publish(CHANNELS.DUEL_DISPUTED(duelId), "DUEL_DISPUTED", disputedMapped);

            // Attempt auto-resolution via external game API
            if (disputed.gameId) {
                try {
                    const [game] = await db.select().from(games).where(eq(games.id, disputed.gameId));
                    const apiKey = getApiKeyForGame(game?.name);
                    if (game?.apiBaseUrl && apiKey) {
                        const verifiedWinner = await verifyWinnerViaGameApi(
                            game.apiBaseUrl,
                            apiKey,
                            game.name,
                            duelId,
                            disputed.player1GameProfileId,
                            disputed.player2GameProfileId,
                        );
                        if (verifiedWinner) {
                            const verifiedUser = await requireUser(verifiedWinner);

                            const resolveTxSig = await resolveDisputeOnChain(duelId, verifiedUser.walletKey, disputed.tokenMint);

                            const loserUsername =
                                verifiedWinner === disputed.player1Username
                                    ? disputed.player2Username!
                                    : disputed.player1Username;
                            const loser = await requireUser(loserUsername);

                            const resolved = await db.transaction(async (tx) => {
                                const [row] = await tx
                                    .update(duels)
                                    .set({
                                        winnerUsername: verifiedWinner,
                                        winnerId: verifiedUser.id,
                                        status: "SETTLED",
                                        txSignature: resolveTxSig,
                                    })
                                    .where(eq(duels.id, duelId))
                                    .returning();

                                await tx.update(users).set({ wins: sql`${users.wins} + 1`, updatedAt: new Date() }).where(eq(users.id, verifiedUser.id));
                                await tx.update(users).set({ losses: sql`${users.losses} + 1`, updatedAt: new Date() }).where(eq(users.id, loser.id));

                                return row;
                            });

                            const resolvedMapped = mapRow(resolved);
                            await publish(CHANNELS.DUEL_SETTLED(duelId), "DUEL_SETTLED", resolvedMapped);

                            return { duel: resolvedMapped, resolved: true };
                        }
                    }
                } catch (err) {
                    // Auto-resolution failed — leave as DISPUTED for admin
                    console.error(`Game API auto-resolution failed for duel ${duelId}:`, err);
                }
            }

            return { duel: disputedMapped, resolved: false };
        }
    }

    return { duel: mapRow(updated), resolved: false };
}

/**
 * Cancel an open duel (only by creator, only if player 2 hasn't joined).
 */
export async function cancelDuel(duelId: string, username: string, txSignature?: string): Promise<Duel> {
    const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "OPEN") throw new Error("Only open duels can be cancelled");
    if (username !== duel.player1Username) throw new Error("Only the creator can cancel the duel");
    if (duel.player2Username !== null) throw new Error("Cannot cancel duel after another player has joined");
    if (!txSignature) throw new Error("Transaction signature is required for on-chain verification");

    // Verify the cancel transaction on-chain
    const isValidTx = await verifyCancelEscrowTx(txSignature);
    if (!isValidTx) {
        throw new Error("Invalid or unverified cancel transaction signature");
    }

    const [cancelled] = await db
        .update(duels)
        .set({ status: "CANCELLED", txSignature })
        .where(eq(duels.id, duelId))
        .returning();

    const cancelledMapped = mapRow(cancelled);

    // Publish cancellation event
    await publish(CHANNELS.DUEL_CANCELLED, "DUEL_CANCELLED", cancelledMapped);

    return cancelledMapped;
}

/**
 * Get a single duel by ID.
 */
export async function getDuel(duelId: string): Promise<Duel> {
    const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));
    if (!duel) throw new Error("Duel not found");
    return mapRow(duel);
}

/**
 * Get all duels filtered by status, newest first.
 */
export async function getDuelsByStatus(status: DuelStatus): Promise<Duel[]> {
    const rows = await db
        .select()
        .from(duels)
        .where(eq(duels.status, status))
        .orderBy(desc(duels.createdAt));
    return rows.map(mapRow);
}

/**
 * Cancel all OPEN duels that have passed their expiresAt timestamp.
 * Returns the number of rows affected.
 */
export async function cleanUpExpiredDuels(): Promise<number> {
    const result = await db
        .update(duels)
        .set({ status: "CANCELLED" })
        .where(and(eq(duels.status, "OPEN"), lt(duels.expiresAt, new Date())));

    return result.rowCount ?? 0;
}
