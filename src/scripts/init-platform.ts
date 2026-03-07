/**
 * One-time script: Initialize the PlatformConfig PDA on-chain.
 *
 * This MUST be run once after deploying the escrow program.
 * Without it, settle_escrow / dispute_escrow / resolve_dispute all fail
 * with Anchor error 3012 (AccountNotInitialized) on the platform_config account.
 *
 * Usage:  bun src/scripts/init-platform.ts
 *
 * Reads from .env:
 *   SOLANA_AUTHORITY_KEY  – the authority keypair (becomes platform admin)
 *   TREASURY_PUBKEY       – treasury wallet that receives fees
 *   ESCROW_PROGRAM_ID     – deployed program ID
 *   SOLANA_RPC_URL        – Solana cluster RPC
 */

import { escrowSdk, authorityKeypair, treasuryPubkey, findPlatformConfigPDA, programId } from "../config/solana";

const FEE_BPS = 250; // 2.5% platform fee

async function main() {
    console.log("=== Initialize PlatformConfig ===");
    console.log(`Program:   ${programId.toBase58()}`);
    console.log(`Authority: ${authorityKeypair.publicKey.toBase58()}`);
    console.log(`Treasury:  ${treasuryPubkey.toBase58()}`);
    console.log(`Fee:       ${FEE_BPS} bps (${FEE_BPS / 100}%)`);

    const [pda] = findPlatformConfigPDA(programId);
    console.log(`PDA:       ${pda.toBase58()}`);
    console.log();

    try {
        const txSig = await escrowSdk.initializePlatform(
            authorityKeypair,
            treasuryPubkey,
            FEE_BPS,
        );
        console.log("PlatformConfig initialized successfully!");
        console.log(`TX: ${txSig}`);
        console.log(`Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
    } catch (err: any) {
        if (err.message?.includes("already in use") || err.logs?.some((l: string) => l.includes("already in use"))) {
            console.log("PlatformConfig already initialized — nothing to do.");
        } else {
            console.error("Failed to initialize PlatformConfig:");
            console.error(err);
            process.exit(1);
        }
    }
}

main();
