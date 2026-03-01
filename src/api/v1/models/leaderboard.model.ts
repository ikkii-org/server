export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    pfp: string | null;
    wins: number;
    losses: number;
    winPercentage: number;
    totalStakeWon: number;
    totalStakeLost: number;
    currentRank: number;
    previousRank: number;
}
