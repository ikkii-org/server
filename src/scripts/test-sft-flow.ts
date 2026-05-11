/**
 * Quick end-to-end script: test the V2 SFT escrow flow on devnet.
 * Uses a 0-decimal, supply-2 mint so both players can stake 1 token.
 */

import { Keypair, PublicKey, Connection, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
    createMint,
    getOrCreateAssociatedTokenAccount,
    mintTo,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import { escrowSdkV2, authorityKeypair, treasuryPubkey, findEscrowPDA, findVaultPDA, solanaConnection } from "../config/solana";
import { uuidToBytes } from "ikkii-escrow-sdk";
import { randomUUID } from "crypto";

async function fundFromAuthority(pubkey: PublicKey, sol = 0.5) {
    const { SystemProgram, Transaction } = await import("@solana/web3.js");
    const tx = new Transaction().add(
        SystemProgram.transfer({
            fromPubkey: authorityKeypair.publicKey,
            toPubkey: pubkey,
            lamports: sol * 1e9,
        })
    );
    const sig = await sendAndConfirmTransaction(solanaConnection, tx, [authorityKeypair]);
    console.log(`Funded ${sol} SOL to ${pubkey.toBase58()} — tx ${sig}`);
}

async function main() {
    const player1 = Keypair.generate();
    const player2 = Keypair.generate();
    console.log("Player1:", player1.publicKey.toBase58());
    console.log("Player2:", player2.publicKey.toBase58());

    await fundFromAuthority(player1.publicKey, 0.01);
    await fundFromAuthority(player2.publicKey, 0.01);

    // Create SFT mint (supply 2, decimals 0)
    const sftMint = await createMint(
        solanaConnection,
        authorityKeypair,
        authorityKeypair.publicKey,
        null,
        0,
        undefined,
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
    );
    console.log("SFT Mint:", sftMint.toBase58());

    // Create ATAs and mint 1 SFT to each player
    const player1Ata = await getOrCreateAssociatedTokenAccount(
        solanaConnection,
        authorityKeypair,
        sftMint,
        player1.publicKey,
        false,
        "confirmed",
        undefined,
        TOKEN_PROGRAM_ID,
    );
    const player2Ata = await getOrCreateAssociatedTokenAccount(
        solanaConnection,
        authorityKeypair,
        sftMint,
        player2.publicKey,
        false,
        "confirmed",
        undefined,
        TOKEN_PROGRAM_ID,
    );

    await mintTo(
        solanaConnection,
        authorityKeypair,
        sftMint,
        player1Ata.address,
        authorityKeypair.publicKey,
        1,
        [],
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
    );
    await mintTo(
        solanaConnection,
        authorityKeypair,
        sftMint,
        player2Ata.address,
        authorityKeypair.publicKey,
        1,
        [],
        { commitment: "confirmed" },
        TOKEN_PROGRAM_ID,
    );
    console.log("Minted 1 SFT to each player");

    const duelId = randomUUID();
    const duelIdBuf = uuidToBytes(duelId);
    const expiry = Math.floor(Date.now() / 1000) + 60 * 30; // 30 min

    console.log("\n=== 1. Create Escrow (v2) ===");
    const createTx = await escrowSdkV2.createEscrow(
        player1,
        duelIdBuf,
        new BN(1), // stake_amount = 1
        sftMint,
        new BN(expiry),
        player1Ata.address,
        TOKEN_PROGRAM_ID,
    );
    console.log("Create tx:", createTx);

    console.log("\n=== 2. Join Escrow (v2) ===");
    const joinTx = await escrowSdkV2.joinEscrow(
        player2,
        duelIdBuf,
        player2Ata.address,
    );
    console.log("Join tx:", joinTx);

    console.log("\n=== 3. Settle Escrow (player2 wins) ===");
    const [platformConfigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform_config")],
        escrowSdkV2.programId,
    );
    const [escrowPDA] = findEscrowPDA(duelIdBuf, escrowSdkV2.programId);
    const [vaultPDA] = findVaultPDA(duelIdBuf, escrowSdkV2.programId);

    const treasuryAta = await getOrCreateAssociatedTokenAccount(
        solanaConnection,
        authorityKeypair,
        sftMint,
        treasuryPubkey,
        false,
        "confirmed",
        undefined,
        TOKEN_PROGRAM_ID,
    );

    const settleTx = await escrowSdkV2.settleEscrow(
        authorityKeypair,
        duelIdBuf,
        player2.publicKey,
        player2Ata.address,
        treasuryAta.address,
    );
    console.log("Settle tx:", settleTx);

    // Verify balances
    const player2Balance = await solanaConnection.getTokenAccountBalance(player2Ata.address);
    console.log("\nPlayer2 SFT balance after settle:", player2Balance.value.amount);

    console.log("\n=== SUCCESS ===");
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
