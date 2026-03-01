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
import { adminMiddleware } from "../middleware/admin.middleware";

export const escrowRoutes = new Hono();

// POST /escrow/wallets                    — create a wallet (admin only — auto-called on signup)
escrowRoutes.post("/wallets", adminMiddleware, createWalletHandler);

// GET  /escrow/wallets/:userId            — get own wallet
escrowRoutes.get("/wallets/:userId", getWalletHandler);

// POST /escrow/wallets/:userId/deposit    — deposit funds (on-chain confirmed)
escrowRoutes.post("/wallets/:userId/deposit", depositHandler);

// POST /escrow/wallets/:userId/withdraw   — withdraw funds
escrowRoutes.post("/wallets/:userId/withdraw", withdrawHandler);

// POST /escrow/wallets/:userId/lock       — lock funds for a duel (admin only)
escrowRoutes.post("/wallets/:userId/lock", adminMiddleware, lockFundsHandler);

// POST /escrow/wallets/:userId/unlock     — unlock funds (admin only)
escrowRoutes.post("/wallets/:userId/unlock", adminMiddleware, unlockFundsHandler);

// POST /escrow/transfer                   — transfer stake from loser to winner (admin only)
escrowRoutes.post("/transfer", adminMiddleware, transferStakeHandler);

