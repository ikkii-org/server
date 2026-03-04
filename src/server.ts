import app from "./app";
import "./utils/sentry/instruments";
import { connectRedis } from "./config/redis";
import { connectPubSub } from "./services/pubsub.service";
import { websocketHandler, createWebSocketData } from "./handlers/websocket.handler";

const port = process.env.PORT || 3000;

// Connect to Redis (cache + pub/sub)
await connectRedis();
await connectPubSub();

console.log(`server running on port ${port}`);

export default {
    port,
    
    // Handle HTTP requests with Hono
    fetch(req: Request, server: any) {
        // Check if this is a WebSocket upgrade request
        const url = new URL(req.url);
        
        if (url.pathname === "/ws") {
            // Upgrade to WebSocket
            const upgraded = server.upgrade(req, {
                data: createWebSocketData(),
            });
            
            if (upgraded) {
                return; // Bun handles the response
            }
            
            return new Response("WebSocket upgrade failed", { status: 400 });
        }
        
        // Regular HTTP request - pass to Hono
        return app.fetch(req);
    },
    
    // WebSocket handlers
    websocket: websocketHandler,
};
