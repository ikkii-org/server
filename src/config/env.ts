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
} as const;
