import app from "./app";
import "./utils/sentry/instruments";
import { connectRedis } from "./config/redis";

const port = process.env.PORT || 3000;

await connectRedis();

console.log(`server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
