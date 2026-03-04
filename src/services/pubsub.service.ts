import { createClient, RedisClientType } from "redis";
import { env } from "../config/env";

// ─── Redis Clients ────────────────────────────────────────────────────────────
// Pub/Sub requires separate connections for publishing and subscribing

let publisher: RedisClientType;
let subscriber: RedisClientType;

// ─── Channel Names ────────────────────────────────────────────────────────────

export const CHANNELS = {
    // Global channels (anyone can subscribe)
    DUEL_CREATED: "duel:created",
    DUEL_CANCELLED: "duel:cancelled",
    
    // Duel-specific channels
    DUEL_JOINED: (duelId: string) => `duel:${duelId}:joined`,
    DUEL_RESULT: (duelId: string) => `duel:${duelId}:result`,
    DUEL_SETTLED: (duelId: string) => `duel:${duelId}:settled`,
    DUEL_DISPUTED: (duelId: string) => `duel:${duelId}:disputed`,
} as const;

// ─── Event Types ──────────────────────────────────────────────────────────────

export interface PubSubEvent<T = unknown> {
    type: string;
    data: T;
    timestamp: number;
}

// ─── Connect ──────────────────────────────────────────────────────────────────

export async function connectPubSub(): Promise<void> {
    publisher = createClient({ url: env.REDIS_URL });
    subscriber = createClient({ url: env.REDIS_URL });

    publisher.on("error", (err) => console.error("[PubSub] Publisher error:", err));
    subscriber.on("error", (err) => console.error("[PubSub] Subscriber error:", err));

    await publisher.connect();
    await subscriber.connect();

    console.log("[PubSub] Connected");
}

// ─── Publish ──────────────────────────────────────────────────────────────────

export async function publish<T>(channel: string, type: string, data: T): Promise<void> {
    const event: PubSubEvent<T> = {
        type,
        data,
        timestamp: Date.now(),
    };

    await publisher.publish(channel, JSON.stringify(event));
    console.log(`[PubSub] Published to ${channel}:`, type);
}

// ─── Subscribe ────────────────────────────────────────────────────────────────

export async function subscribe(
    channel: string,
    callback: (event: PubSubEvent) => void
): Promise<void> {
    await subscriber.subscribe(channel, (message) => {
        try {
            const event = JSON.parse(message) as PubSubEvent;
            callback(event);
        } catch (err) {
            console.error("[PubSub] Failed to parse message:", err);
        }
    });
    console.log(`[PubSub] Subscribed to ${channel}`);
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────

export async function unsubscribe(channel: string): Promise<void> {
    await subscriber.unsubscribe(channel);
    console.log(`[PubSub] Unsubscribed from ${channel}`);
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

export async function disconnectPubSub(): Promise<void> {
    await publisher?.quit();
    await subscriber?.quit();
    console.log("[PubSub] Disconnected");
}
