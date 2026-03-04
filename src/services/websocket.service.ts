import type { ServerWebSocket } from "bun";
import { subscribe, unsubscribe, CHANNELS, type PubSubEvent } from "./pubsub.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebSocketData {
    id: string;
    username?: string;
    subscribedChannels: Set<string>;
}

type WSClient = ServerWebSocket<WebSocketData>;

// ─── Client Storage ───────────────────────────────────────────────────────────

// All connected clients
const clients = new Map<string, WSClient>();

// Channel -> client IDs mapping (who is listening to what)
const channelSubscribers = new Map<string, Set<string>>();

// ─── Client Management ────────────────────────────────────────────────────────

export function addClient(ws: WSClient): void {
    clients.set(ws.data.id, ws);
    console.log(`[WS] Client connected: ${ws.data.id}`);
}

export function removeClient(ws: WSClient): void {
    // Unsubscribe from all channels
    for (const channel of ws.data.subscribedChannels) {
        unsubscribeClient(ws, channel);
    }
    clients.delete(ws.data.id);
    console.log(`[WS] Client disconnected: ${ws.data.id}`);
}

// ─── Channel Subscriptions ────────────────────────────────────────────────────

export async function subscribeClient(ws: WSClient, channel: string): Promise<void> {
    // Add client to channel subscribers
    if (!channelSubscribers.has(channel)) {
        channelSubscribers.set(channel, new Set());
        
        // First subscriber - subscribe to Redis
        await subscribe(channel, (event) => {
            broadcastToChannel(channel, event);
        });
    }
    
    channelSubscribers.get(channel)!.add(ws.data.id);
    ws.data.subscribedChannels.add(channel);
    
    console.log(`[WS] Client ${ws.data.id} subscribed to ${channel}`);
}

export function unsubscribeClient(ws: WSClient, channel: string): void {
    const subscribers = channelSubscribers.get(channel);
    if (subscribers) {
        subscribers.delete(ws.data.id);
        
        // Last subscriber - unsubscribe from Redis
        if (subscribers.size === 0) {
            channelSubscribers.delete(channel);
            unsubscribe(channel).catch(console.error);
        }
    }
    
    ws.data.subscribedChannels.delete(channel);
}

// ─── Broadcasting ─────────────────────────────────────────────────────────────

function broadcastToChannel(channel: string, event: PubSubEvent): void {
    const subscribers = channelSubscribers.get(channel);
    if (!subscribers) return;

    const message = JSON.stringify(event);
    
    for (const clientId of subscribers) {
        const client = clients.get(clientId);
        if (client) {
            client.send(message);
        }
    }
    
    console.log(`[WS] Broadcasted to ${subscribers.size} clients on ${channel}`);
}

// Send to a specific client
export function sendToClient(clientId: string, event: PubSubEvent): void {
    const client = clients.get(clientId);
    if (client) {
        client.send(JSON.stringify(event));
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getClientCount(): number {
    return clients.size;
}

export function generateClientId(): string {
    return crypto.randomUUID();
}
