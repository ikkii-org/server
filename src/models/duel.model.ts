import { DuelStatus } from "../types/duel.types"

export interface Duel {
    id: string
    player1: string
    player2: string
    stakeAmount: number
    tokenMint: string
    status: DuelStatus
    winner?: string
    player1SubmittedWinner?: string
    player2SubmittedWinner?: string
    expiresAt: Date
    createdAt: Date
}