/**
 * Solana configuration singleton.
 *
 * Boots an Anchor provider, loads the escrow IDL, and exposes a ready-to-use
 * IkkiEscrowSDK instance + the authority keypair for server-signed transactions.
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { env } from "./env";

// Import the generated IDL — Anchor writes this after `anchor build`
import idl from "../../../escrow/target/idl/ikki_escrow.json";

// Import the generated type for the program
import type { IkkiEscrow } from "../../../escrow/target/types/ikki_escrow";

// Import SDK helpers from the escrow workspace
import {
    IkkiEscrowSDK,
    findPlatformConfigPDA,
    findEscrowPDA,
    findVaultPDA,
    uuidToBytes,
} from "../../../escrow/sdk/src/sdk";

// ── Authority Keypair ────────────────────────────────────────────────────────

const authoritySecret = Uint8Array.from(JSON.parse(env.SOLANA_AUTHORITY_KEY));
export const authorityKeypair = Keypair.fromSecretKey(authoritySecret);

// ── Connection & Provider ────────────────────────────────────────────────────

export const solanaConnection = new Connection(env.SOLANA_RPC_URL, "confirmed");

const wallet = new Wallet(authorityKeypair);
export const anchorProvider = new AnchorProvider(solanaConnection, wallet, {
    commitment: "confirmed",
});

// ── Program & SDK ────────────────────────────────────────────────────────────

const programId = new PublicKey(env.ESCROW_PROGRAM_ID);
export const escrowProgram = new Program<IkkiEscrow>(idl as any, anchorProvider);

// NOTE: The `as any` casts below work around a dual-package Anchor type conflict.
// The server and escrow each have their own @coral-xyz/anchor in node_modules,
// causing TS to see them as incompatible types. Bun resolves this correctly at runtime.
export const escrowSdk = new IkkiEscrowSDK(escrowProgram as any, anchorProvider as any);

// ── Re-exports for convenience ───────────────────────────────────────────────

export const treasuryPubkey = new PublicKey(env.TREASURY_PUBKEY);
export const tokenMint = new PublicKey(env.TOKEN_MINT);

export {
    findPlatformConfigPDA,
    findEscrowPDA,
    findVaultPDA,
    uuidToBytes,
};
