// Validates required environment variables at startup.
// Import this module early (e.g. in server.ts) so misconfiguration is caught immediately.

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return value;
}

export const env = {
    DATABASE_URL: requireEnv("DATABASE_URL"),
    JWT_SECRET: requireEnv("JWT_SECRET"),
    COOKIE_SECRET: requireEnv("COOKIE_SECRET"),
    /** e.g. "1h", "7d" — anything recognised by the hono/jwt helper */
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "1h",
    PORT: parseInt(process.env.PORT ?? "3000", 10),
    NODE_ENV: process.env.NODE_ENV ?? "development",
    /** Secret key required in X-Admin-Secret header to access admin-only endpoints */
    ADMIN_SECRET: process.env.ADMIN_SECRET ?? "",
    /** Comma-separated list of allowed CORS origins, e.g. "https://app.ikkii.gg,http://localhost:3000" */
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),

    REDIS_URL: requireEnv("REDIS_URL"),

    // ── Solana / Escrow ─────────────────────────────────────────────────────
    /** Solana RPC endpoint (e.g. https://api.devnet.solana.com) */
    SOLANA_RPC_URL: requireEnv("SOLANA_RPC_URL"),
    /** JSON-encoded 64-byte authority keypair array */
    SOLANA_AUTHORITY_KEY: requireEnv("SOLANA_AUTHORITY_KEY"),
    /** Deployed escrow program ID */
    ESCROW_PROGRAM_ID: requireEnv("ESCROW_PROGRAM_ID"),
    /** Treasury wallet public key (receives platform fees) */
    TREASURY_PUBKEY: requireEnv("TREASURY_PUBKEY"),
    /** SPL token mint address for duels (e.g. devnet USDC) */
    TOKEN_MINT: requireEnv("TOKEN_MINT"),

    // ── Game Integrations ───────────────────────────────────────────────────
    /** Clash Royale Bearer JWT token from developer.clashroyale.com */
    CLASH_ROYALE_TOKEN: requireEnv("CLASH_ROYALE_TOKEN")
} as const;
