'use strict';
// Çok küçük bir TTL önbelleği (örnek başına). Aynı anda gelen istekler tek sorguyu paylaşır.
const store = new Map();

function cached(key, ttlMs, fn) {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.exp > now) return hit.p;
  const p = Promise.resolve().then(fn);
  store.set(key, { p, exp: now + ttlMs });
  p.catch(() => { const h = store.get(key); if (h && h.p === p) store.delete(key); });
  return p;
}

function bust(key) { store.delete(key); }

module.exports = { cached, bust };
