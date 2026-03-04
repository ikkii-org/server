/**
 * On-chain service — wraps the escrow SDK for server-side operations.
 *
 * The server uses these helpers to execute authority-signed transactions
 * (settle, dispute, resolve) and to query the external game API for
 * dispute auto-resolution.
 */

import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
    escrowSdk,
    authorityKeypair,
    treasuryPubkey,
    tokenMint,
    uuidToBytes,
} from "../../../config/solana";

// ── UUID → Buffer ────────────────────────────────────────────────────────────

/**
 * Convert a postgres UUID string to a 16-byte Buffer for PDA derivation.
 */
export function duelIdToBuffer(duelUuid: string): Buffer {
    return uuidToBytes(duelUuid);
}

// ── Settle on-chain ──────────────────────────────────────────────────────────

/**
 * Settle a duel on-chain. The authority signs the transaction.
 * Returns the Solana transaction signature.
 */
export async function settleOnChain(
    duelUuid: string,
    winnerWalletKey: string,
): Promise<string> {
    const winnerPubkey = new PublicKey(winnerWalletKey);

    // Derive the winner's associated token account for the duel's token mint
    const winnerTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        winnerPubkey,
    );

    // Derive the treasury's associated token account
    const treasuryTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        treasuryPubkey,
    );

    const duelIdBuf = duelIdToBuffer(duelUuid);

    const txSig = await escrowSdk.settleEscrow(
        authorityKeypair,
        duelIdBuf,
        winnerPubkey,
        winnerTokenAccount,
        treasuryTokenAccount,
    );

    return txSig;
}

// ── Dispute on-chain ─────────────────────────────────────────────────────────

/**
 * Mark a duel as disputed on-chain.
 * Returns the Solana transaction signature.
 */
export async function disputeOnChain(duelUuid: string): Promise<string> {
    const duelIdBuf = duelIdToBuffer(duelUuid);
    const txSig = await escrowSdk.disputeEscrow(authorityKeypair, duelIdBuf);
    return txSig;
}

// ── Resolve dispute on-chain ─────────────────────────────────────────────────

/**
 * Resolve a disputed duel on-chain, awarding the winner.
 * Returns the Solana transaction signature.
 */
export async function resolveDisputeOnChain(
    duelUuid: string,
    winnerWalletKey: string,
): Promise<string> {
    const winnerPubkey = new PublicKey(winnerWalletKey);

    const winnerTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        winnerPubkey,
    );

    const treasuryTokenAccount = getAssociatedTokenAddressSync(
        tokenMint,
        treasuryPubkey,
    );

    const duelIdBuf = duelIdToBuffer(duelUuid);

    const txSig = await escrowSdk.resolveDispute(
        authorityKeypair,
        duelIdBuf,
        winnerPubkey,
        winnerTokenAccount,
        treasuryTokenAccount,
    );

    return txSig;
}

// ── External game API verification ───────────────────────────────────────────

/**
 * Call an external game's API to verify who won a specific match.
 * Returns the winner's username, or null if the API is unavailable or
 * returns inconclusive data.
 *
 * The `apiUrl` should contain a `:matchId` placeholder that will be
 * replaced with the actual duel/match ID.
 */
export async function verifyWinnerViaGameApi(
    apiUrl: string,
    duelId: string,
): Promise<string | null> {
    try {
        const url = apiUrl.replace(":matchId", duelId);
        const response = await fetch(url, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        if (!response.ok) {
            console.error(`Game API returned ${response.status} for duel ${duelId}`);
            return null;
        }

        const data = await response.json() as { winner?: string };
        return data.winner ?? null;
    } catch (err) {
        console.error(`Game API verification failed for duel ${duelId}:`, err);
        return null;
    }
}
