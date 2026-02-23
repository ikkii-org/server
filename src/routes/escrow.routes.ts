import { Hono } from "hono";
import {
    createWalletHandler,
    getWalletHandler,
    depositHandler,
    withdrawHandler,
    lockFundsHandler,
    unlockFundsHandler,
    transferStakeHandler,
} from "../controllers/escrow.controller";

export const escrowRoutes = new Hono();

// POST /escrow/wallets                    — create a wallet for a user
escrowRoutes.post("/wallets", createWalletHandler);

// GET  /escrow/wallets/:userId            — get a user's wallet
escrowRoutes.get("/wallets/:userId", getWalletHandler);

// POST /escrow/wallets/:userId/deposit    — deposit funds (on-chain confirmed)
escrowRoutes.post("/wallets/:userId/deposit", depositHandler);

// POST /escrow/wallets/:userId/withdraw   — withdraw funds
escrowRoutes.post("/wallets/:userId/withdraw", withdrawHandler);

// POST /escrow/wallets/:userId/lock       — lock funds for a duel
escrowRoutes.post("/wallets/:userId/lock", lockFundsHandler);

// POST /escrow/wallets/:userId/unlock     — unlock funds (e.g. duel cancelled)
escrowRoutes.post("/wallets/:userId/unlock", unlockFundsHandler);

// POST /escrow/transfer                   — transfer stake from loser to winner
escrowRoutes.post("/transfer", transferStakeHandler);
