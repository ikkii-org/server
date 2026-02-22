export interface Player {
    userId: number;
    username: string;
    walletKey: string;
    pfp: string | null;
    wins: number;
    losses: number;
    totalWon: number;
    totalLost: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface PlayerProfile {
    username: string;
    pfp: string | null;
    wins: number;
    losses: number;
    totalWon: number;
    totalLost: number;
    winPercentage: number;
}