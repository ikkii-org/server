/**
 * Solana configuration singleton.
 *
 * Boots an Anchor provider, loads the escrow IDL, and exposes a ready-to-use
 * IkkiiEscrowSDK instance + the authority keypair for server-signed transactions.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { env } from "./env";

// Import the generated IDL — copied from escrow/target/idl/ after `anchor build`
import idl from "./ikkii_escrow.json";
import idlV2 from "./ikkii_escrow_v2.json";

// Import SDK + types from the published package
import type { IkkiiEscrow, IkkiiEscrowV2 } from "ikkii-escrow-sdk";
import {
    IkkiiEscrowSDK,
    IkkiiEscrowV2SDK,
    findPlatformConfigPDA,
    findEscrowPDA,
    findVaultPDA,
    uuidToBytes,
} from "ikkii-escrow-sdk";

// ── Authority Keypair ────────────────────────────────────────────────────────

const authoritySecret = Uint8Array.from(JSON.parse(env.SOLANA_AUTHORITY_KEY));
export const authorityKeypair = Keypair.fromSecretKey(authoritySecret);

// ── Connection & Provider ────────────────────────────────────────────────────

export const solanaConnection = new Connection(env.SOLANA_RPC_URL, "confirmed");

const wallet = new Wallet(authorityKeypair);
export const anchorProvider = new AnchorProvider(solanaConnection, wallet, {
    commitment: "confirmed",
});

// ── V1 Program & SDK ─────────────────────────────────────────────────────────

export const programId = new PublicKey(env.ESCROW_PROGRAM_ID);
export const escrowProgram = new Program<IkkiiEscrow>(idl as any, anchorProvider);

// NOTE: The `as any` casts below work around a dual-package Anchor type conflict.
// The server and escrow each have their own @coral-xyz/anchor in node_modules,
// causing TS to see them as incompatible types. Bun resolves this correctly at runtime.
export const escrowSdk = new IkkiiEscrowSDK(escrowProgram as any, anchorProvider as any);

// ── V2 Program & SDK ─────────────────────────────────────────────────────────

export const programIdV2 = new PublicKey(env.ESCROW_V2_PROGRAM_ID);
export const escrowProgramV2 = new Program<IkkiiEscrowV2>(idlV2 as any, anchorProvider);
export const escrowSdkV2 = new IkkiiEscrowV2SDK(escrowProgramV2 as any, anchorProvider as any);

// ── Re-exports for convenience ───────────────────────────────────────────────

export const treasuryPubkey = new PublicKey(env.TREASURY_PUBKEY);
export const tokenMint = new PublicKey(env.TOKEN_MINT);

export {
    findPlatformConfigPDA,
    findEscrowPDA,
    findVaultPDA,
    uuidToBytes,
};
