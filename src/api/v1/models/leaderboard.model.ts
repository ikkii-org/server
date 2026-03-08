export interface LeaderboardEntry {
    rank: number;
    userId: string;
    username: string;
    pfp: string | null;
    wins: number;
    losses: number;
    winPercentage: number;
    totalStakeWon: string;
    totalStakeLost: string;
    currentRank: number;
    previousRank: number;
}
