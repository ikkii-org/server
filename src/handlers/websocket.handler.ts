import type { ServerWebSocket } from "bun";
import {
    addClient,
    removeClient,
    subscribeClient,
    generateClientId,
} from "../services/websocket.service";
import { CHANNELS } from "../services/pubsub.service";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WebSocketData {
    id: string;
    username?: string;
    subscribedChannels: Set<string>;
}

// ─── Message Types ────────────────────────────────────────────────────────────

interface ClientMessage {
    action: "subscribe" | "unsubscribe";
    channel: string;
}

// ─── WebSocket Handlers ───────────────────────────────────────────────────────

export const websocketHandler = {
    /**
     * Called when a new WebSocket connection is opened
     */
    open(ws: ServerWebSocket<WebSocketData>) {
        addClient(ws);
        
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
                    subscribeClient(ws, msg.channel);
                    ws.send(JSON.stringify({
                        type: "subscribed",
                        data: { channel: msg.channel },
                        timestamp: Date.now(),
                    }));
                    break;
                    
                case "unsubscribe":
                    // unsubscribeClient handled in websocket.service
                    ws.send(JSON.stringify({
                        type: "unsubscribed",
                        data: { channel: msg.channel },
                        timestamp: Date.now(),
                    }));
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
