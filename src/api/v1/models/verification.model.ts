export interface VerificationResult {
    duelId: string;
    verified: boolean;
    winnerUsername: string | null;
    reason: string;
}
