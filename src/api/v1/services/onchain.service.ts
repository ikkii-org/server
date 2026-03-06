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
    solanaConnection,
    programId,
} from "../../../config/solana";
import bs58 from "bs58";
import { db } from "../../../db";
import { gameProfiles, users } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { verifyMatchBetweenPlayers } from "./clash-royale.service";

// ── UUID → Buffer ────────────────────────────────────────────────────────────

/**
 * Convert a postgres UUID string to a 16-byte Buffer for PDA derivation.
 */
export function duelIdToBuffer(duelUuid: string): Buffer {
    return uuidToBytes(duelUuid);
}

// ── Verification on-chain ────────────────────────────────────────────────────

/**
 * Verify a Mobile Wallet Adapter create_escrow transaction signature.
 * Ensures the transaction succeeded, interacted with the escrow program,
 * and matches the expected instruction discriminator.
 */
export async function verifyCreateEscrowTx(
    txSig: string,
    expectedDuelId: string,
    expectedStakeAmountSmallest: number,
): Promise<boolean> {
    try {
        const tx = await solanaConnection.getParsedTransaction(txSig, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
        });

        if (!tx) {
            console.error(`[verifyCreateEscrowTx] Transaction not found: ${txSig}`);
            return false;
        }

        if (tx.meta?.err) {
            console.error(`[verifyCreateEscrowTx] Transaction failed on-chain: ${txSig}`);
            return false;
        }

        // Find the instruction calling our Escrow Program
        const ix = tx.transaction.message.instructions.find(
            (i: any) => i.programId.equals(programId)
        );

        if (!ix) {
            console.error(`[verifyCreateEscrowTx] Escrow program not called in tx: ${txSig}`);
            return false;
        }

        // In a parsed tx, if it can't parse the custom program data, it falls back to PartiallyDecodedInstruction
        if ("data" in ix) {
            // Discriminator for create_escrow is [253, 215, 165, 116, 36, 108, 68, 80]
            const dataBuf = Buffer.from(bs58.decode(ix.data));
            const discriminator = dataBuf.subarray(0, 8);
            const expectedDiscriminator = Buffer.from([253, 215, 165, 116, 36, 108, 68, 80]);

            if (!discriminator.equals(expectedDiscriminator)) {
                console.error(`[verifyCreateEscrowTx] Invalid instruction discriminator in tx: ${txSig}`);
                return false;
            }

            // Instruction layout (after 8-byte discriminator):
            //   bytes  8..23 — duelId (16-byte UUID)
            //   bytes 24..31 — stakeAmount (u64 little-endian)
            //   bytes 32..39 — expiresAt  (i64 little-endian, unix seconds)
            if (dataBuf.length < 40) {
                console.error(`[verifyCreateEscrowTx] Instruction data too short (${dataBuf.length} bytes)`);
                return false;
            }

            // Verify duelId matches
            const duelIdBytes = uuidToBytes(expectedDuelId);
            const txDuelIdBytes = dataBuf.subarray(8, 24);
            if (!txDuelIdBytes.equals(duelIdBytes)) {
                console.error(`[verifyCreateEscrowTx] duelId mismatch in tx ${txSig}`);
                return false;
            }

            // Verify stakeAmount matches (u64 LE) — compare against smallest-unit value
            const txStakeAmount = dataBuf.readBigUInt64LE(24);
            if (Number(txStakeAmount) !== expectedStakeAmountSmallest) {
                console.error(
                    `[verifyCreateEscrowTx] stakeAmount mismatch: tx has ${txStakeAmount}, expected ${expectedStakeAmountSmallest}`
                );
                return false;
            }

            return true;
        }

        return false;
    } catch (err) {
        console.error(`[verifyCreateEscrowTx] Error verifying tx ${txSig}:`, err);
        return false;
    }
}

/**
 * Verify a Mobile Wallet Adapter join_escrow transaction signature.
 * Also checks that the escrow PDA in the transaction matches the expected duelId,
 * preventing replay of a valid join tx from a different duel.
 */
export async function verifyJoinEscrowTx(txSig: string, expectedDuelId?: string): Promise<boolean> {
    try {
        const tx = await solanaConnection.getParsedTransaction(txSig, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
        });

        if (!tx || tx.meta?.err) return false;

        const ix = tx.transaction.message.instructions.find(
            (i: any) => i.programId.equals(programId)
        ) as any;

        if (!ix || !("data" in ix)) return false;

        const dataBuf = Buffer.from(bs58.decode(ix.data));
        const discriminator = dataBuf.subarray(0, 8);
        const expectedDiscriminator = Buffer.from([205, 250, 117, 19, 126, 211, 205, 103]);

        if (!discriminator.equals(expectedDiscriminator)) return false;

        // Additional PDA check: verify the escrow account in the tx accounts
        // matches the PDA we'd derive for the expected duelId.
        if (expectedDuelId && ix.accounts && ix.accounts.length >= 2) {
            const duelIdBuf = uuidToBytes(expectedDuelId);
            const [expectedEscrowPda] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow"), duelIdBuf],
                programId,
            );
            // The escrow PDA is the second account in the join_escrow instruction
            const actualEscrowPda: PublicKey = ix.accounts[1];
            if (!expectedEscrowPda.equals(actualEscrowPda)) {
                console.error(`[verifyJoinEscrowTx] PDA mismatch for duel ${expectedDuelId}. Got ${actualEscrowPda.toBase58()}, expected ${expectedEscrowPda.toBase58()}`);
                return false;
            }
        }

        return true;
    } catch (err) {
        console.error(`[verifyJoinEscrowTx] Error verifying tx ${txSig}:`, err);
        return false;
    }
}

/**
 * Verify a Mobile Wallet Adapter cancel_escrow transaction signature.
 * The cancel is signed by player1 (the duel creator), not the authority.
 */
export async function verifyCancelEscrowTx(txSig: string): Promise<boolean> {
    try {
        const tx = await solanaConnection.getParsedTransaction(txSig, {
            maxSupportedTransactionVersion: 0,
            commitment: "confirmed",
        });

        if (!tx || tx.meta?.err) return false;

        const ix = tx.transaction.message.instructions.find(
            (i: any) => i.programId.equals(programId)
        );

        if (!ix || !("data" in ix)) return false;

        const dataBuf = Buffer.from(bs58.decode(ix.data));
        const discriminator = dataBuf.subarray(0, 8);
        // cancel_escrow discriminator: [156, 203, 54, 179, 38, 72, 33, 21]
        const expectedDiscriminator = Buffer.from([156, 203, 54, 179, 38, 72, 33, 21]);

        return discriminator.equals(expectedDiscriminator);
    } catch (err) {
        console.error(`[verifyCancelEscrowTx] Error verifying tx ${txSig}:`, err);
        return false;
    }
}

// ── Settle on-chain ──────────────────────────────────────────────────────────

/**
 * Settle a duel on-chain. The authority signs the transaction.
 * Returns the Solana transaction signature.
 */
export async function settleOnChain(
    duelUuid: string,
    winnerWalletKey: string,
    duelTokenMint?: string,
): Promise<string> {
    const winnerPubkey = new PublicKey(winnerWalletKey);

    // Use the per-duel token mint if provided, otherwise fall back to the global default.
    const mint = duelTokenMint ? new PublicKey(duelTokenMint) : tokenMint;

    // Derive the winner's associated token account for the duel's token mint
    const winnerTokenAccount = getAssociatedTokenAddressSync(
        mint,
        winnerPubkey,
    );

    // Derive the treasury's associated token account
    const treasuryTokenAccount = getAssociatedTokenAddressSync(
        mint,
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
    duelTokenMint?: string,
): Promise<string> {
    const winnerPubkey = new PublicKey(winnerWalletKey);

    // Use the per-duel token mint if provided, otherwise fall back to the global default.
    const mint = duelTokenMint ? new PublicKey(duelTokenMint) : tokenMint;

    const winnerTokenAccount = getAssociatedTokenAddressSync(
        mint,
        winnerPubkey,
    );

    const treasuryTokenAccount = getAssociatedTokenAddressSync(
        mint,
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
 * Currently supports: Clash Royale
 */
export async function verifyWinnerViaGameApi(
    apiBaseUrl: string,
    apiKey: string,
    gameName: string,
    duelId: string,
    player1GameProfileId: string | null,
    player2GameProfileId: string | null,
): Promise<string | null> {
    try {
        // Game-specific verification logic
        if (gameName.toLowerCase() === "clash royale") {
            return await verifyClashRoyaleMatch(
                apiBaseUrl,
                apiKey,
                player1GameProfileId,
                player2GameProfileId,
            );
        }

        // Fallback: generic API (expects { winner: "username" } response)
        console.warn(`No specific integration for game: ${gameName}`);
        return null;
    } catch (err) {
        console.error(`Game API verification failed for duel ${duelId}:`, err);
        return null;
    }
}

// ── Clash Royale Verification ────────────────────────────────────────────────

/**
 * Verify a Clash Royale match between two players.
 * Looks up their player tags from gameProfiles and checks the battle log.
 */
async function verifyClashRoyaleMatch(
    apiBaseUrl: string,
    apiKey: string,
    player1GameProfileId: string | null,
    player2GameProfileId: string | null,
): Promise<string | null> {
    if (!player1GameProfileId || !player2GameProfileId) {
        console.warn("Missing game profile IDs for Clash Royale verification");
        return null;
    }

    // Get player tags from game profiles
    const [profile1] = await db
        .select()
        .from(gameProfiles)
        .where(eq(gameProfiles.id, player1GameProfileId));

    const [profile2] = await db
        .select()
        .from(gameProfiles)
        .where(eq(gameProfiles.id, player2GameProfileId));

    if (!profile1?.playerId || !profile2?.playerId) {
        console.warn("One or both players missing Clash Royale player tag");
        return null;
    }

    // Call Clash Royale API to verify match
    const result = await verifyMatchBetweenPlayers(
        apiBaseUrl,
        apiKey,
        profile1.playerId, // player tag (e.g., "#ABC123")
        profile2.playerId,
        30, // within last 30 minutes
    );

    if (!result.verified || !result.winner) {
        console.warn(`Clash Royale verification: ${result.reason}`);
        return null;
    }

    // Map winner tag back to username
    const winnerProfileId = result.winner === profile1.playerId
        ? player1GameProfileId
        : player2GameProfileId;

    const [winnerProfile] = await db
        .select({ userId: gameProfiles.userId })
        .from(gameProfiles)
        .where(eq(gameProfiles.id, winnerProfileId));

    if (!winnerProfile) return null;

    const [winner] = await db
        .select({ username: users.username })
        .from(users)
        .where(eq(users.id, winnerProfile.userId));

    return winner?.username ?? null;
}
