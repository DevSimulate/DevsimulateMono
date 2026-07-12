/**
 * Minimal in-memory TTL cache. Intended for hot, read-heavy public endpoints
 * (e.g. the DevFest leaderboard) where serving a snapshot a few seconds stale is
 * fine and recomputing per request would hammer the database under event traffic.
 *
 * Single-process only — if the API runs multiple instances each keeps its own
 * cache, which is acceptable for a leaderboard (scores just refresh per instance
 * within the TTL). No eviction beyond expiry; keyspace is small (one per tag).
 */
type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

/** Returns the cached value for `key` if present and not expired, else null. */
export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

/** Stores `value` under `key` for `ttlMs` milliseconds. */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
