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

// ─── Cache Types ──────────────────────────────────────────────────────────────

// Static data: rarely changes (only on profile update)
export interface UserStatic {
    userId: string;
    username: string;
    pfp: string | null;
}

// Stats data: changes frequently (after each duel)
export interface UserStats {
    wins: number;
    losses: number;
    winPercentage: number;
    portfolio: PlayerProfile["portfolio"];
}
