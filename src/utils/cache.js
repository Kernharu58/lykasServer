const { getRedisClient } = require("../config/redis");

// Simple cache-aside helpers for read-heavy, low-churn public endpoints
// (GET /api/pets, GET /api/announcements/active — see §11.7). Every function
// here is a safe no-op when Redis isn't connected, so callers never need an
// `if (redisAvailable)` branch of their own — cacheGet just returns null
// (a "miss"), and cacheSet/cacheDeleteByPrefix silently do nothing.

const DEFAULT_TTL_SECONDS = 60;

const cacheGet = async (key) => {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`[cache] get failed for "${key}":`, err.message);
    return null;
  }
};

const cacheSet = async (key, value, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch (err) {
    console.error(`[cache] set failed for "${key}":`, err.message);
  }
};

// Invalidate every cached entry under a prefix, e.g. "pets:list:" after a
// pet is created/updated/deleted. We cache one entry per distinct query
// string (different filters = different cache key), so a write can't target
// a single exact key to invalidate — it has to sweep the whole family.
// Uses SCAN (not KEYS) so this doesn't block Redis on a large keyspace.
const cacheDeleteByPrefix = async (prefix) => {
  const client = getRedisClient();
  if (!client) return;
  try {
    const keysToDelete = [];
    // NOTE: scanIterator on the installed redis client (v6) yields one SCAN
    // *batch* per iteration (an array of keys), not a single key at a time —
    // confirmed against the actual installed client, since this differs from
    // older node-redis examples online. Handle both shapes defensively.
    for await (const batch of client.scanIterator({
      MATCH: `${prefix}*`,
      COUNT: 100,
    })) {
      if (Array.isArray(batch)) keysToDelete.push(...batch);
      else keysToDelete.push(batch);
    }
    if (keysToDelete.length) await client.del(keysToDelete);
  } catch (err) {
    console.error(`[cache] prefix delete failed for "${prefix}":`, err.message);
  }
};

module.exports = { cacheGet, cacheSet, cacheDeleteByPrefix };
