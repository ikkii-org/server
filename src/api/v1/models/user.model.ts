export interface PlayerProfile {
    userId: string;
    username: string;
    pfp: string | null;
    wins: number;
    losses: number;
    winPercentage: number;
    portfolio: {
        solanaBalance: number;
        currentRank: number;
        previousRank: number;
        totalStakeWon: number;
        totalStakeLost: number;
    } | null;
}
