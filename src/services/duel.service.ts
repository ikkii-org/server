import { Duel } from "../models/duel.model";
import { randomUUID } from "crypto";

// In-memory store for MVP (replace with database later)
const duels = new Map<string, Duel>();

export async function createDuel(
    player1Username: string,
    stakeAmount: number,
    tokenMint: string,
    expiresInMs: number = 30 * 60 * 1000 // 30 min default
): Promise<Duel> {
    if (!player1Username) {
        throw new Error("Player username is required");
    }
    if (stakeAmount <= 0) {
        throw new Error("Stake amount must be greater than 0");
    }
    if (!tokenMint) {
        throw new Error("Token mint is required");
    }

    const duel: Duel = {
        id: randomUUID(),
        player1Username,
        player2Username: null,
        stakeAmount,
        tokenMint,
        status: "OPEN",
        expiresAt: new Date(Date.now() + expiresInMs),
        createdAt: new Date(),
    };

    duels.set(duel.id, duel);

    // TODO: Call escrow service to lock player1's stake on-chain

    return duel;
}


export async function joinDuel(duelId: string, player2Username: string): Promise<Duel> {
    const duel = duels.get(duelId);
    if (!duel) {
        throw new Error("Duel not found");
    }
    if (duel.status !== "OPEN") {
        throw new Error("Duel is not open for joining");
    }
    if (duel.player1Username === player2Username) {
        throw new Error("Player cannot join their own duel");
    }
    if (duel.expiresAt < new Date()) {
        throw new Error("Duel has expired");
    }

    duel.player2Username = player2Username;
    duel.status = "ACTIVE";
    duels.set(duel.id, duel);
    return duel;
}


export async function submitResult(
    duelId: string,
    username: string,
    claimedWinnerUsername: string
): Promise<{ duel: Duel; resolved: boolean }> {
    const duel = duels.get(duelId);
    if (!duel) {
        throw new Error("Duel not found");
    }
    if (duel.status !== "ACTIVE") {
        throw new Error("Duel is not active");
    }
    if (username !== duel.player1Username && username !== duel.player2Username) {
        throw new Error("Only participants can submit results");
    }
    if (claimedWinnerUsername !== duel.player1Username && claimedWinnerUsername !== duel.player2Username) {
        throw new Error("Winner must be one of the duel participants");
    }

    if (username === duel.player1Username) {
        if (duel.player1SubmittedWinner) {
            throw new Error("Player 1 has already submitted a result");
        }
        duel.player1SubmittedWinner = claimedWinnerUsername;
    } else {
        if (duel.player2SubmittedWinner) {
            throw new Error("Player 2 has already submitted a result");
        }
        duel.player2SubmittedWinner = claimedWinnerUsername;
    }

    duels.set(duel.id, duel);

    if (duel.player1SubmittedWinner && duel.player2SubmittedWinner) {
        if (duel.player1SubmittedWinner === duel.player2SubmittedWinner) {
            duel.winnerUsername = duel.player1SubmittedWinner;
            duel.status = "SETTLED";
            duels.set(duel.id, duel);
            // TODO: Call escrow service to pay out winner
            return { duel, resolved: true };
        } else {
            duel.status = "DISPUTED";
            duels.set(duel.id, duel);
            // TODO: Trigger verification.service to check via game API
            return { duel, resolved: false };
        }
    }

    // Waiting for other player's submission
    return { duel, resolved: false };
}


export async function cancelDuel(duelId: string, username: string): Promise<Duel> {
    const duel = duels.get(duelId);
    if (!duel) {
        throw new Error("Duel not found");
    }
    if (duel.status !== "OPEN") {
        throw new Error("Only open duels can be cancelled");
    }
    if (username !== duel.player1Username) {
        throw new Error("Only the creator can cancel the duel");
    }
    if (duel.player2Username === null) {
        duel.status = "CANCELLED";
        duels.set(duel.id, duel);
        return duel;
    }
    throw new Error("Cannot cancel duel after another player has joined");
}


export async function cleanUpExpiredDuels(): Promise<number> {
    const now = new Date();
    let count = 0;
    for (const duel of duels.values()) {
        if (duel.status === "OPEN" && duel.expiresAt < now) {
            duel.status = "CANCELLED";
            duels.set(duel.id, duel);
            count++;
        }
    }
    return count;
}


export async function getDuel(duelId: string): Promise<Duel> {
    const duel = duels.get(duelId);
    if (!duel) {
        throw new Error("Duel not found");
    }
    return duel;
}

// Helper for testing/debugging
export function getDuelStore(): Map<string, Duel> {
    return duels;
}
