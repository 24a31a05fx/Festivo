const PURGE_THRESHOLD = 5000;
const MAX_ENTRIES = 10_000;

// Fixed-window request counter keyed by client address.
// Note: In-memory limits are per process or serverless instance, not a globally
// shared cluster quota. Because windows reset at resetAt, clients can make up
// to 2 * max requests across the window boundary (boundary-burst characteristic).
export function createRateLimiter({ windowMs, max, now = Date.now }) {
  const windows = new Map();

  function purgeExpired(current) {
    for (const [key, entry] of windows) {
      if (entry.resetAt <= current) windows.delete(key);
    }
  }

  function check(key) {
    const current = now();
    if (windows.size > PURGE_THRESHOLD) purgeExpired(current);
    if (windows.size >= MAX_ENTRIES && !windows.has(key)) {
      const oldestKey = windows.keys().next().value;
      if (oldestKey !== undefined) windows.delete(oldestKey);
    }

    let entry = windows.get(key);
    if (!entry || entry.resetAt <= current) {
      entry = { count: 0, resetAt: current + windowMs };
      windows.set(key, entry);
    }
    entry.count += 1;

    return {
      allowed: entry.count <= max,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - current) / 1000)),
    };
  }

  return { check, get size() { return windows.size; } };
}
