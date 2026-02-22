import { DuelStatus } from "../types/duel.types"

export interface Duel {
    id: string
    player1Username: string
    player2Username: string | null
    stakeAmount: number
    tokenMint: string
    status: DuelStatus
    winnerUsername?: string
    player1SubmittedWinner?: string
    player2SubmittedWinner?: string
    expiresAt: Date
    createdAt: Date
}