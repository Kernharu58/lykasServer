const { createClient } = require("redis");

// `redis` has been a listed dependency since the project started, but was
// never actually imported anywhere — every rate limiter ran on
// express-rate-limit's in-memory MemoryStore, which resets on every restart
// and doesn't share state across more than one server instance. This module
// is what actually connects it.
//
// REDIS_URL is intentionally optional here: if it isn't set (e.g. local dev
// without a Redis instance running), the app still boots and runs correctly
// — rate limiting just falls back to in-memory state and the cache helpers
// in utils/cache.js become no-ops. Production deployments should always set
// REDIS_URL so rate limits and caching actually work as intended.

let client = null;
let isReady = false;

const connectRedis = async () => {
  const url = process.env.REDIS_URL;

  if (!url) {
    console.warn(
      "[redis] REDIS_URL not set — rate limiting will use in-memory storage " +
        "(resets on restart, not shared across instances) and response " +
        "caching is disabled. Set REDIS_URL to enable both.",
    );
    return null;
  }

  client = createClient({
    url,
    socket: {
      // Bound the initial dial — without this, an unreachable REDIS_URL
      // (typo, wrong host, Redis not up yet) hangs server startup
      // indefinitely, since node-redis's default reconnect strategy retries
      // forever. Confirmed this hang happens without these two options.
      connectTimeout: 5000,
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.error("[redis] giving up after 5 reconnect attempts — continuing without Redis.");
          return new Error("Redis reconnect attempts exhausted");
        }
        return Math.min(retries * 200, 2000);
      },
    },
  });

  client.on("error", (err) => {
    isReady = false;
    console.error("[redis] connection error:", err.message);
  });
  client.on("ready", () => {
    isReady = true;
    console.log("[redis] connected");
  });
  client.on("end", () => {
    isReady = false;
  });

  try {
    await client.connect();
  } catch (err) {
    console.error(
      `[redis] failed to connect (${err.message}) — continuing without Redis.`,
    );
    client = null;
    isReady = false;
  }

  return client;
};

// Callers must always go through this getter rather than importing `client`
// directly — it returns null (rather than a half-connected client) whenever
// Redis isn't actually usable right now, so every caller has one place to
// implement the "Redis is optional" fallback instead of re-checking
// connection state everywhere.
const getRedisClient = () => (isReady ? client : null);

module.exports = { connectRedis, getRedisClient };
