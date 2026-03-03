import { redisClient } from "../../../config/redis";

// ─── Cache Key Builders ───────────────────────────────────────────────────────
// Centralized key naming prevents typos and makes debugging easier

export const CACHE_KEYS = {
    // Leaderboard: keyed by limit and offset for pagination
    LEADERBOARD: (limit: number, offset: number) => `leaderboard:${limit}:${offset}`,
} as const;

// ─── Core Cache Operations ────────────────────────────────────────────────────

/**
 * Get a cached value by key.
 * Returns null if not found or on error.
 */
export async function get<T>(key: string): Promise<T | null> {
    try {
        const value = await redisClient.get(key);
        if (value === null) {
            return null;
        }
        return JSON.parse(value) as T;
    } catch (error) {
        console.error(`[Cache] GET error for "${key}":`, error);
        return null;
    }
}

/**
 * Set a cached value (no expiration - for LRU eviction).
 * Returns true on success, false on error.
 */
export async function setLRU<T>(key: string, value: T): Promise<boolean> {
    try {
        const serialized = JSON.stringify(value);
        await redisClient.set(key, serialized);
        return true;
    } catch (error) {
        console.error(`[Cache] SET error for "${key}":`, error);
        return false;
    }
}

/**
 * Delete a cached key.
 * Used for manual cache invalidation.
 */
export async function del(key: string): Promise<boolean> {
    try {
        await redisClient.del(key);
        return true;
    } catch (error) {
        console.error(`[Cache] DEL error for "${key}":`, error);
        return false;
    }
}

/**
 * Delete all keys matching a pattern (e.g., "leaderboard:*").
 * Use sparingly - scans entire keyspace.
 */
export async function delPattern(pattern: string): Promise<boolean> {
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`[Cache] Deleted ${keys.length} keys matching "${pattern}"`);
        }
        return true;
    } catch (error) {
        console.error(`[Cache] DEL pattern error for "${pattern}":`, error);
        return false;
    }
}

export async function clearCache(): Promise<boolean> {
    try {
        await redisClient.flushDb();
        console.log("[Cache] Cleared all cache entries");
        return true;
    } catch (error) {
        console.error("[Cache] Clear cache error:", error);
        return false;
    }
}

// ─── Domain-Specific Invalidation ─────────────────────────────────────────────

/**
 * Invalidate all cached leaderboard pages.
 * Call this when any player's wins/losses/stakes change.
 */
export async function invalidateLeaderboard(): Promise<boolean> {
    console.log("[Cache] Invalidating all leaderboard entries");
    return delPattern("leaderboard:*");
}
