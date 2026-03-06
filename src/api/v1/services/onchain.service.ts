/**
 * On-chain service — wraps the escrow SDK for server-side operations.
 *
 * The server uses these helpers to execute authority-signed transactions
 * (settle, dispute, resolve) and to query the external game API for
 * dispute auto-resolution.
 */

import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
    getAssociatedTokenAddressSync,
    NATIVE_MINT,
    createCloseAccountInstruction,
    createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";
import {
    escrowSdk,
    authorityKeypair,
    treasuryPubkey,
    tokenMint,
    uuidToBytes,
    solanaConnection,
    programId,
    findEscrowPDA,
} from "../../../config/solana";
import bs58 from "bs58";
import { db } from "../../../db";
import { gameProfiles, users } from "../../../db/schema";
import { eq } from "drizzle-orm";
import { verifyMatchBetweenPlayers } from "./clash-royale.service";

// ── Anchor error code map (from IDL) ────────────────────────────────────────

const ANCHOR_ERROR_CODES: Record<number, string> = {
    6000: "Unauthorized",
    6001: "InvalidStatus",
    6002: "SelfDuel",
    6003: "EscrowExpired",
    6004: "NotExpired",
    6005: "InvalidStakeAmount",
    6006: "InvalidWinner",
    6007: "FeeTooHigh",
    6008: "MintMismatch",
    6009: "Overflow",
    6010: "ExpiryInPast",
};

const ESCROW_STATUS_NAMES: Record<number, string> = {
    0: "Open",
    1: "Active",
    2: "Disputed",
    3: "Settled",
    4: "Cancelled",
};

/**
 * Extract the Anchor program error code from an error, if present.
 * Anchor errors typically contain the code in error.error.errorCode.number,
 * or in the error message as "custom program error: 0x..."
 */
function parseAnchorErrorCode(err: unknown): { code: number; name: string } | null {
    if (!err || typeof err !== "object") return null;

    // Anchor SDK error shape: { error: { errorCode: { number, code } } }
    const anchorErr = err as any;
    if (anchorErr?.error?.errorCode?.number != null) {
        const code = anchorErr.error.errorCode.number;
        return { code, name: ANCHOR_ERROR_CODES[code] ?? anchorErr.error.errorCode.code ?? "Unknown" };
    }

    // Fallback: parse from message "custom program error: 0x1771" etc.
    const msg = anchorErr?.message ?? anchorErr?.toString?.() ?? "";
    const match = msg.match(/custom program error:\s*0x([0-9a-fA-F]+)/);
    if (match) {
        const code = parseInt(match[1], 16);
        return { code, name: ANCHOR_ERROR_CODES[code] ?? "Unknown" };
    }

    return null;
}

/**
 * Run pre-flight diagnostics before attempting settle. Logs findings but does NOT throw.
 * This helps us identify the root cause when settleOnChain fails.
 */
async function logSettleDiagnostics(
    duelUuid: string,
    winnerPubkey: PublicKey,
    mint: PublicKey,
): Promise<void> {
    const tag = `[settleOnChain:diag][${duelUuid}]`;
    try {
        // 1. Authority SOL balance
        const balance = await solanaConnection.getBalance(authorityKeypair.publicKey);
        const balanceSol = balance / 1e9;
        console.log(`${tag} Authority ${authorityKeypair.publicKey.toBase58()} balance: ${balanceSol} SOL`);
        if (balanceSol < 0.01) {
            console.warn(`${tag} WARNING: Authority balance very low (${balanceSol} SOL) — tx fees may fail`);
        }

        // 2. Fetch on-chain escrow state
        const duelIdBuf = uuidToBytes(duelUuid);
        const [escrowPDA] = findEscrowPDA(duelIdBuf, programId);
        console.log(`${tag} Escrow PDA: ${escrowPDA.toBase58()}`);

        try {
            const escrowAccount = await escrowSdk.fetchEscrow(duelIdBuf);
            const statusNum = typeof escrowAccount.status === "object"
                ? Object.keys(escrowAccount.status)[0]
                : escrowAccount.status;
            const statusLabel = typeof statusNum === "string"
                ? statusNum
                : ESCROW_STATUS_NAMES[statusNum as number] ?? `unknown(${statusNum})`;

            console.log(`${tag} Escrow status: ${statusLabel}`);
            console.log(`${tag} Escrow player1: ${escrowAccount.player1.toBase58()}`);
            console.log(`${tag} Escrow player2: ${escrowAccount.player2.toBase58()}`);
            console.log(`${tag} Winner arg:     ${winnerPubkey.toBase58()}`);
            console.log(`${tag} Stake amount:   ${escrowAccount.stakeAmount.toString()} (smallest units)`);
            console.log(`${tag} Token mint:     ${escrowAccount.tokenMint.toBase58()}`);
            console.log(`${tag} Expiry:         ${new Date(Number(escrowAccount.expiry) * 1000).toISOString()}`);

            // Check status
            if (statusLabel !== "Active" && statusLabel !== "active") {
                console.error(`${tag} PROBLEM: Escrow status is "${statusLabel}" — settleEscrow requires "Active" (error 6001)`);
            }

            // Check winner matches player1 or player2
            const matchesP1 = winnerPubkey.equals(escrowAccount.player1);
            const matchesP2 = winnerPubkey.equals(escrowAccount.player2);
            if (!matchesP1 && !matchesP2) {
                console.error(`${tag} PROBLEM: Winner ${winnerPubkey.toBase58()} does NOT match player1 or player2 (error 6006)`);
            } else {
                console.log(`${tag} Winner matches: ${matchesP1 ? "player1" : "player2"}`);
            }

            // Check mint matches
            if (!mint.equals(escrowAccount.tokenMint)) {
                console.error(`${tag} PROBLEM: Mint mismatch — duel has ${mint.toBase58()}, escrow has ${escrowAccount.tokenMint.toBase58()} (error 6008)`);
            }
        } catch (fetchErr) {
            console.error(`${tag} Could not fetch escrow account (may not exist on-chain):`, fetchErr);
        }
    } catch (diagErr) {
        console.error(`${tag} Diagnostics failed (non-fatal):`, diagErr);
    }
}

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
 * For wSOL duels, ensure the recipient has a wSOL ATA before the settle tx
 * (the program will transfer wSOL tokens into it), then close it afterward
 * to convert the wSOL back to native SOL.
 *
 * Returns the close tx signature (or null if not a wSOL duel).
 */
async function unwrapWsolAfterSettle(
    mint: PublicKey,
    recipientPubkey: PublicKey,
): Promise<string | null> {
    if (!mint.equals(NATIVE_MINT)) return null;

    const wsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, recipientPubkey);

    // Check if ATA has a non-zero wSOL balance before closing
    let balance = 0n;
    try {
        const info = await solanaConnection.getTokenAccountBalance(wsolAta);
        balance = BigInt(info.value.amount);
    } catch {
        // ATA doesn't exist or has no balance — nothing to unwrap
        return null;
    }

    if (balance === 0n) return null;

    // Close the wSOL ATA: sends all lamports (stake + rent) to the recipient wallet.
    // The authority (our server keypair) acts as the close authority only if it owns the ATA.
    // But the ATA is owned by the recipient — so the recipient must be the close authority.
    // Since the recipient is the winner (not our keypair), we cannot sign on their behalf.
    //
    // Solution: The server does NOT close the winner's ATA.
    // Instead, the winner's mobile app closes it themselves (on next app open / explicitly).
    // The wSOL is already in their ATA — it is spendable as wSOL and will auto-appear
    // as SOL balance in wallets that support wSOL (Phantom, Backpack, etc.).
    //
    // For the TREASURY ATA (server-controlled): we CAN close it since we hold the keypair.
    // The treasury will just hold wSOL until swept.
    //
    // This is the correct production-safe approach — we never hold winner private keys.
    return null;
}

/**
 * Settle a duel on-chain. The authority signs the transaction.
 * For wSOL duels, ensures the winner and treasury wSOL ATAs exist before settling.
 * Returns the Solana transaction signature.
 */
export async function settleOnChain(
    duelUuid: string,
    winnerWalletKey: string,
    duelTokenMint?: string,
): Promise<string> {
    const tag = `[settleOnChain][${duelUuid}]`;
    const winnerPubkey = new PublicKey(winnerWalletKey);

    // Use the per-duel token mint if provided, otherwise fall back to the global default.
    const mint = duelTokenMint ? new PublicKey(duelTokenMint) : tokenMint;

    console.log(`${tag} Starting settlement — winner=${winnerWalletKey}, mint=${mint.toBase58()}`);

    // Run pre-flight diagnostics (logs findings, never throws)
    await logSettleDiagnostics(duelUuid, winnerPubkey, mint);

    // Derive the winner's associated token account for the duel's token mint
    const winnerTokenAccount = getAssociatedTokenAddressSync(mint, winnerPubkey);
    console.log(`${tag} Winner ATA: ${winnerTokenAccount.toBase58()}`);

    // Derive the treasury's associated token account
    const treasuryTokenAccount = getAssociatedTokenAddressSync(mint, treasuryPubkey);
    console.log(`${tag} Treasury ATA: ${treasuryTokenAccount.toBase58()}`);

    // For wSOL duels: ensure winner and treasury wSOL ATAs exist before the settle
    // tx tries to transfer tokens into them. Use idempotent create — safe to always include.
    if (mint.equals(NATIVE_MINT)) {
        console.log(`${tag} wSOL duel — sending ATA setup tx...`);
        try {
            const setupTx = new Transaction();
            setupTx.add(
                createAssociatedTokenAccountIdempotentInstruction(
                    authorityKeypair.publicKey,
                    winnerTokenAccount,
                    winnerPubkey,
                    NATIVE_MINT,
                ),
                createAssociatedTokenAccountIdempotentInstruction(
                    authorityKeypair.publicKey,
                    treasuryTokenAccount,
                    treasuryPubkey,
                    NATIVE_MINT,
                ),
            );
            const setupSig = await sendAndConfirmTransaction(solanaConnection, setupTx, [authorityKeypair]);
            console.log(`${tag} wSOL ATA setup tx confirmed: ${setupSig}`);
        } catch (setupErr) {
            console.error(`${tag} wSOL ATA setup tx FAILED — settlement cannot proceed:`, setupErr);
            throw new Error(`wSOL ATA setup failed: ${setupErr instanceof Error ? setupErr.message : String(setupErr)}`);
        }
    }

    const duelIdBuf = duelIdToBuffer(duelUuid);

    try {
        console.log(`${tag} Sending settleEscrow tx...`);
        const txSig = await escrowSdk.settleEscrow(
            authorityKeypair,
            duelIdBuf,
            winnerPubkey,
            winnerTokenAccount,
            treasuryTokenAccount,
        );
        console.log(`${tag} settleEscrow SUCCESS — tx: ${txSig}`);
        return txSig;
    } catch (settleErr) {
        const anchorCode = parseAnchorErrorCode(settleErr);
        if (anchorCode) {
            console.error(`${tag} settleEscrow FAILED with Anchor error ${anchorCode.code} (${anchorCode.name}):`, settleErr);
        } else {
            console.error(`${tag} settleEscrow FAILED (non-Anchor error):`, settleErr);
        }
        throw settleErr;
    }
}

// ── Dispute on-chain ─────────────────────────────────────────────────────────

/**
 * Mark a duel as disputed on-chain.
 * Returns the Solana transaction signature.
 */
export async function disputeOnChain(duelUuid: string): Promise<string> {
    const tag = `[disputeOnChain][${duelUuid}]`;
    console.log(`${tag} Marking duel as disputed on-chain...`);
    const duelIdBuf = duelIdToBuffer(duelUuid);
    try {
        const txSig = await escrowSdk.disputeEscrow(authorityKeypair, duelIdBuf);
        console.log(`${tag} disputeEscrow SUCCESS — tx: ${txSig}`);
        return txSig;
    } catch (err) {
        const anchorCode = parseAnchorErrorCode(err);
        if (anchorCode) {
            console.error(`${tag} disputeEscrow FAILED with Anchor error ${anchorCode.code} (${anchorCode.name}):`, err);
        } else {
            console.error(`${tag} disputeEscrow FAILED:`, err);
        }
        throw err;
    }
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
    const tag = `[resolveDisputeOnChain][${duelUuid}]`;
    const winnerPubkey = new PublicKey(winnerWalletKey);

    // Use the per-duel token mint if provided, otherwise fall back to the global default.
    const mint = duelTokenMint ? new PublicKey(duelTokenMint) : tokenMint;

    console.log(`${tag} Starting dispute resolution — winner=${winnerWalletKey}, mint=${mint.toBase58()}`);

    // Run pre-flight diagnostics
    await logSettleDiagnostics(duelUuid, winnerPubkey, mint);

    const winnerTokenAccount = getAssociatedTokenAddressSync(mint, winnerPubkey);
    const treasuryTokenAccount = getAssociatedTokenAddressSync(mint, treasuryPubkey);

    // For wSOL duels: ensure winner and treasury wSOL ATAs exist before the resolve tx.
    if (mint.equals(NATIVE_MINT)) {
        console.log(`${tag} wSOL duel — sending ATA setup tx...`);
        try {
            const setupTx = new Transaction();
            setupTx.add(
                createAssociatedTokenAccountIdempotentInstruction(
                    authorityKeypair.publicKey,
                    winnerTokenAccount,
                    winnerPubkey,
                    NATIVE_MINT,
                ),
                createAssociatedTokenAccountIdempotentInstruction(
                    authorityKeypair.publicKey,
                    treasuryTokenAccount,
                    treasuryPubkey,
                    NATIVE_MINT,
                ),
            );
            const setupSig = await sendAndConfirmTransaction(solanaConnection, setupTx, [authorityKeypair]);
            console.log(`${tag} wSOL ATA setup tx confirmed: ${setupSig}`);
        } catch (setupErr) {
            console.error(`${tag} wSOL ATA setup tx FAILED:`, setupErr);
            throw new Error(`wSOL ATA setup failed: ${setupErr instanceof Error ? setupErr.message : String(setupErr)}`);
        }
    }

    const duelIdBuf = duelIdToBuffer(duelUuid);

    try {
        console.log(`${tag} Sending resolveDispute tx...`);
        const txSig = await escrowSdk.resolveDispute(
            authorityKeypair,
            duelIdBuf,
            winnerPubkey,
            winnerTokenAccount,
            treasuryTokenAccount,
        );
        console.log(`${tag} resolveDispute SUCCESS — tx: ${txSig}`);
        return txSig;
    } catch (resolveErr) {
        const anchorCode = parseAnchorErrorCode(resolveErr);
        if (anchorCode) {
            console.error(`${tag} resolveDispute FAILED with Anchor error ${anchorCode.code} (${anchorCode.name}):`, resolveErr);
        } else {
            console.error(`${tag} resolveDispute FAILED (non-Anchor error):`, resolveErr);
        }
        throw resolveErr;
    }
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
