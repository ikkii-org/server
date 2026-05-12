/**
 * Quick NFT Minter for Devnet Demo
 *
 * Usage: bun src/scripts/mint-demo-nft.ts <recipient-wallet-key>
 *
 * Creates a Metaplex NFT named "Ikkii" with metadata,
 * then transfers it to the recipient wallet.
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner, percentAmount, keypairIdentity } from "@metaplex-foundation/umi";
import { createNft, mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import {
    createAssociatedTokenAccountIdempotentInstruction,
    createTransferInstruction,
    getAssociatedTokenAddressSync,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { authorityKeypair, solanaConnection } from "../config/solana";

async function main() {
    const recipientWalletKey = process.argv[2];
    if (!recipientWalletKey) {
        console.error("Usage: bun src/scripts/mint-demo-nft.ts <recipient-wallet-key>");
        process.exit(1);
    }

    const recipientPubkey = new PublicKey(recipientWalletKey);

    // Create Umi instance on devnet
    const umi = createUmi("https://api.devnet.solana.com");

    // Create Umi keypair from authority secret key
    const umiAuthority = umi.eddsa.createKeypairFromSecretKey(authorityKeypair.secretKey);
    umi.use(keypairIdentity(umiAuthority));
    umi.use(mplTokenMetadata());

    const mint = generateSigner(umi);

    console.log("Creating 'Ikkii' NFT...");
    console.log("Mint:", mint.publicKey.toString());
    console.log("Recipient:", recipientWalletKey);

    // 1. Create NFT with Metaplex (minted to authority/creator by default)
    const { signature: createSig } = await createNft(umi, {
        mint,
        name: "Ikkii",
        symbol: "IKKII",
        uri: "https://arweave.net/1234567890abcdef/ikkii-nft.json",
        sellerFeeBasisPoints: percentAmount(0),
    }).sendAndConfirm(umi);

    console.log("\n=== 1. NFT Created ===");
    console.log("Mint:", mint.publicKey.toString());
    console.log("Tx:", createSig.toString());

    // 2. Transfer from creator ATA to recipient ATA
    const mintPubkey = new PublicKey(mint.publicKey.toString());
    const creatorAta = getAssociatedTokenAddressSync(mintPubkey, authorityKeypair.publicKey, false, TOKEN_PROGRAM_ID);
    const recipientAta = getAssociatedTokenAddressSync(mintPubkey, recipientPubkey, false, TOKEN_PROGRAM_ID);

    const tx = new Transaction();
    tx.add(
        createAssociatedTokenAccountIdempotentInstruction(
            authorityKeypair.publicKey,
            recipientAta,
            recipientPubkey,
            mintPubkey,
            TOKEN_PROGRAM_ID,
        ),
        createTransferInstruction(
            creatorAta,
            recipientAta,
            authorityKeypair.publicKey,
            1,
            [],
            TOKEN_PROGRAM_ID,
        ),
    );

    const transferSig = await sendAndConfirmTransaction(solanaConnection, tx, [authorityKeypair]);

    console.log("\n=== 2. NFT Transferred to Recipient ===");
    console.log("Recipient ATA:", recipientAta.toBase58());
    console.log("Tx:", transferSig);

    console.log("\n=== SUCCESS ===");
    console.log("Recipient now owns 1 'Ikkii' NFT");
    console.log("Explorer:", `https://explorer.solana.com/address/${mint.publicKey.toString()}?cluster=devnet`);
    console.log("\nUpdate DEMO_NFT_MINT in mobile/src/app/(tabs)/create.tsx to:");
    console.log(mint.publicKey.toString());
}

main().catch((err) => {
    console.error("Mint failed:", err);
    process.exit(1);
});
