import type { ServerWebSocket } from "bun";
import {
    addClient,
    removeClient,
    subscribeClient,
    unsubscribeClient,
    generateClientId,
} from "../services/websocket.service";
import { CHANNELS } from "../services/pubsub.service";

// ─── Constants ────────────────────────────────────────────────────────────────

// Allowed channel patterns (prevent arbitrary subscriptions)
const ALLOWED_CHANNEL_PATTERNS = [
    /^duel:created$/,
    /^duel:cancelled$/,
    /^duel:[a-f0-9-]+:(joined|result|settled|disputed)$/,
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebSocketData {
    id: string;
    username?: string;
    subscribedChannels: Set<string>;
}

// ─── Message Types ────────────────────────────────────────────────────────────

interface ClientMessage {
    action: "subscribe" | "unsubscribe" | "ping";
    channel?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidChannel(channel: string): boolean {
    return ALLOWED_CHANNEL_PATTERNS.some(pattern => pattern.test(channel));
}

// ─── WebSocket Handlers ───────────────────────────────────────────────────────

export const websocketHandler = {
    /**
     * Called when a new WebSocket connection is opened
     */
    open(ws: ServerWebSocket<WebSocketData>) {
        const accepted = addClient(ws);
        
        if (!accepted) {
            ws.send(JSON.stringify({
                type: "error",
                data: { message: "Server at capacity" },
                timestamp: Date.now(),
            }));
            ws.close(1013, "Server at capacity");
            return;
        }
        
        // Send welcome message
        ws.send(JSON.stringify({
            type: "connected",
            data: { clientId: ws.data.id },
            timestamp: Date.now(),
        }));
        
        // Auto-subscribe to global duel events
        subscribeClient(ws, CHANNELS.DUEL_CREATED);
        subscribeClient(ws, CHANNELS.DUEL_CANCELLED);
    },

    /**
     * Called when a message is received from client
     */
    message(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
        try {
            const msg = JSON.parse(message.toString()) as ClientMessage;
            
            switch (msg.action) {
                case "subscribe":
                    if (!msg.channel) {
                        ws.send(JSON.stringify({ type: "error", data: { message: "Channel required" }, timestamp: Date.now() }));
                        break;
                    }
                    if (!isValidChannel(msg.channel)) {
                        ws.send(JSON.stringify({ type: "error", data: { message: "Invalid channel" }, timestamp: Date.now() }));
                        break;
                    }
                    subscribeClient(ws, msg.channel);
                    ws.send(JSON.stringify({
                        type: "subscribed",
                        data: { channel: msg.channel },
                        timestamp: Date.now(),
                    }));
                    break;
                    
                case "unsubscribe":
                    if (msg.channel) {
                        unsubscribeClient(ws, msg.channel);
                    }
                    ws.send(JSON.stringify({
                        type: "unsubscribed",
                        data: { channel: msg.channel },
                        timestamp: Date.now(),
                    }));
                    break;
                
                case "ping":
                    ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
                    break;
                    
                default:
                    ws.send(JSON.stringify({
                        type: "error",
                        data: { message: "Unknown action" },
                        timestamp: Date.now(),
                    }));
            }
        } catch (err) {
            ws.send(JSON.stringify({
                type: "error",
                data: { message: "Invalid message format" },
                timestamp: Date.now(),
            }));
        }
    },

    /**
     * Called when the WebSocket connection is closed
     */
    close(ws: ServerWebSocket<WebSocketData>) {
        removeClient(ws);
    },
};

// ─── Upgrade Helper ───────────────────────────────────────────────────────────

export function createWebSocketData(): WebSocketData {
    return {
        id: generateClientId(),
        subscribedChannels: new Set(),
    };
}
