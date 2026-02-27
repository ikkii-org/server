import app from "./app";
import "./utils/sentry/instruments";

const port = process.env.PORT || 3000;

console.log(`server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
