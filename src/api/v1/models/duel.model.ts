import type { DuelStatus } from "../types/duel.types";

export interface Duel {
    id: string;
    player1Id: string;
    player1Username: string;
    player2Id: string | null;
    player2Username: string | null;
    stakeAmount: number;
    tokenMint: string;
    status: DuelStatus;
    winnerUsername: string | null;
    winnerId: string | null;
    player1SubmittedWinner: string | null;
    player2SubmittedWinner: string | null;
    gameId: string | null;
    expiresAt: Date;
    createdAt: Date;
}

export interface DuelSubmitResult {
    duel: Duel;
    resolved: boolean;
}
