# V2 Escrow End-to-End Test (SFT)

This script tests the full v2 escrow lifecycle with a 0-decimal token (SFT).
Both players stake 1 token, winner receives 2 (minus platform fee).

## Usage

```bash
bun src/scripts/test-sft-flow.ts
```

## What it does

1. Generates two fresh keypairs (player1, player2)
2. Funds them from the authority wallet
3. Creates a 0-decimal mint with supply 2
4. Mints 1 token to each player
5. **Create Escrow** — player1 stakes their token into the vault
6. **Join Escrow** — player2 stakes their token into the vault
7. **Settle Escrow** — authority awards player2, tokens transfer from vault to winner + treasury fee

## Expected output

```
=== 1. Create Escrow (v2) ===
Create tx: <signature>

=== 2. Join Escrow (v2) ===
Join tx: <signature>

=== 3. Settle Escrow (player2 wins) ===
Settle tx: <signature>

Player2 SFT balance after settle: 2

=== SUCCESS ===
```

## Notes

- Uses `createEscrow` (not `createNftEscrow`) because `createNftEscrow` enforces `supply == 1`, which makes it impossible for player2 to join (they can't own the same NFT).
- For the hackathon demo, we use **SFTs with `decimals=0, supply=2`** as a pragmatic stand-in for NFTs. Both players can own 1 copy and stake it.
- The mobile app sends `isNft: true` to the server so the DB records the duel type, but the on-chain instruction is `createEscrow` with `stakeAmount=1`.
