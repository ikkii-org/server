import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { duelRoutes } from "./routes/duel.routes";
import { healthRoutes } from "./routes/health.routes";

const app = new Hono();

app.use("*", logger());
app.use("*", cors());

app.route("/health", healthRoutes);
app.route("/duels", duelRoutes);

app.notFound((c) => {
    return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
});

export default app;
