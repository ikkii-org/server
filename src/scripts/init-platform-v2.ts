/**
 * One-time script: Initialize the PlatformConfig PDA for V2 on-chain.
 *
 * Usage:  bun src/scripts/init-platform-v2.ts
 */

import { escrowSdkV2, authorityKeypair, treasuryPubkey, findPlatformConfigPDA, programIdV2 } from "../config/solana";

const FEE_BPS = 250; // 2.5% platform fee

async function main() {
    console.log("=== Initialize PlatformConfig V2 ===");
    console.log(`Program:   ${programIdV2.toBase58()}`);
    console.log(`Authority: ${authorityKeypair.publicKey.toBase58()}`);
    console.log(`Treasury:  ${treasuryPubkey.toBase58()}`);
    console.log(`Fee:       ${FEE_BPS} bps (${FEE_BPS / 100}%)`);

    const [pda] = findPlatformConfigPDA(programIdV2);
    console.log(`PDA:       ${pda.toBase58()}`);
    console.log();

    try {
        const txSig = await escrowSdkV2.initializePlatform(
            authorityKeypair,
            treasuryPubkey,
            FEE_BPS,
        );
        console.log("PlatformConfig V2 initialized successfully!");
        console.log(`TX: ${txSig}`);
        console.log(`Explorer: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
    } catch (err: any) {
        if (err.message?.includes("already in use") || err.logs?.some((l: string) => l.includes("already in use"))) {
            console.log("PlatformConfig V2 already initialized — nothing to do.");
        } else {
            console.error("Failed to initialize PlatformConfig V2:");
            console.error(err);
            process.exit(1);
        }
    }
}

main();
