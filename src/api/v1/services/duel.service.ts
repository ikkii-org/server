import { db } from "../../../db";
import { duels, users } from "../../../db/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import type { DuelStatus } from "../types/duel.types";
import type { Duel, DuelSubmitResult } from "../models/duel.model";

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
    tokenMint: string,
    gameId?: string,
    expiresInMs: number = 30 * 60 * 1000
): Promise<Duel> {
    if (!player1Username) throw new Error("Player username is required");
    if (stakeAmount <= 0) throw new Error("Stake amount must be greater than 0");
    if (!tokenMint) throw new Error("Token mint is required");

    const player1 = await requireUser(player1Username);

    const [duel] = await db
        .insert(duels)
        .values({
            player1Id: player1.id,
            player1Username: player1.username,
            player2Id: null,
            player2Username: null,
            stakeAmount,
            tokenMint,
            status: "OPEN",
            gameId: gameId ?? null,
            expiresAt: new Date(Date.now() + expiresInMs),
        })
        .returning();

    return mapRow(duel);
}

/**
 * Join an existing open duel as player 2.
 */
export async function joinDuel(duelId: string, player2Username: string): Promise<Duel> {
    const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "OPEN") throw new Error("Duel is not open for joining");
    if (duel.player1Username === player2Username) throw new Error("Player cannot join their own duel");
    if (duel.expiresAt < new Date()) throw new Error("Duel has expired");

    const player2 = await requireUser(player2Username);

    const [updated] = await db
        .update(duels)
        .set({
            player2Id: player2.id,
            player2Username: player2.username,
            status: "ACTIVE",
        })
        .where(eq(duels.id, duelId))
        .returning();

    return mapRow(updated);
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
            // Consensus → settle (wrap in transaction for atomicity)
            const winnerUsername = updated.player1SubmittedWinner;
            const winner = await requireUser(winnerUsername);
            const loserUsername =
                winnerUsername === updated.player1Username
                    ? updated.player2Username!
                    : updated.player1Username;
            const loser = await requireUser(loserUsername);

            const settled = await db.transaction(async (tx) => {
                const [row] = await tx
                    .update(duels)
                    .set({ winnerUsername, winnerId: winner.id, status: "SETTLED" })
                    .where(eq(duels.id, duelId))
                    .returning();

                await tx.update(users).set({ wins: sql`${users.wins} + 1`, updatedAt: new Date() }).where(eq(users.id, winner.id));
                await tx.update(users).set({ losses: sql`${users.losses} + 1`, updatedAt: new Date() }).where(eq(users.id, loser.id));

                return row;
            });

            return { duel: mapRow(settled), resolved: true };
        } else {
            // Dispute
            const [disputed] = await db
                .update(duels)
                .set({ status: "DISPUTED" })
                .where(eq(duels.id, duelId))
                .returning();

            return { duel: mapRow(disputed), resolved: false };
        }
    }

    return { duel: mapRow(updated), resolved: false };
}

/**
 * Cancel an open duel (only by creator, only if player 2 hasn't joined).
 */
export async function cancelDuel(duelId: string, username: string): Promise<Duel> {
    const [duel] = await db.select().from(duels).where(eq(duels.id, duelId));
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "OPEN") throw new Error("Only open duels can be cancelled");
    if (username !== duel.player1Username) throw new Error("Only the creator can cancel the duel");
    if (duel.player2Username !== null) throw new Error("Cannot cancel duel after another player has joined");

    const [cancelled] = await db
        .update(duels)
        .set({ status: "CANCELLED" })
        .where(eq(duels.id, duelId))
        .returning();

    return mapRow(cancelled);
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
