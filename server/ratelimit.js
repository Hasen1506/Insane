// Token-bucket rate limits (C84), no dependencies. A bucket holds `cap` tokens and refills at cap/per
// tokens a millisecond, so over any stretch of d ms it lets through at most cap + d*cap/per requests:
// a burst of `cap`, then the steady rate. Keys are 'class:who' (uid or IP). The clock is injectable for tests
// and is the real clock in the server (never the DEV clock offset, so jumping the test clock a fortnight
// doesn't hand out free tokens).
'use strict';

// Route classes. `per` is in ms. Per-user limits key on uid, per-IP on the socket address (or the first
// X-Forwarded-For hop when TRUST_PROXY=1, as on Render). Env RATE_LIMITS (JSON) overrides any of them,
// e.g. RATE_LIMITS='{"write":{"cap":120}}'.
const MIN = 6e4, HOUR = 36e5, DAY = 864e5;
const CLASSES = {
  write: { cap: 60, per: MIN },        // every set/update/delete, per user
  writeIp: { cap: 600, per: MIN },     // every set/update/delete, per IP (shared Wi-Fi, campus NAT)
  msg: { cap: 30, per: MIN },          // a new message in any thread, room or DM
  post: { cap: 10, per: HOUR },        // a new City post
  call: { cap: 5, per: DAY },          // a new City call
  dare: { cap: 20, per: DAY },         // a dare sent to someone (plan §9: per-user daily dare cap)
  midnight: { cap: 10, per: DAY },     // a queued Midnight message
  clip: { cap: 20, per: DAY },         // a 24 h photo clip
  invite: { cap: 30, per: 10 * MIN },  // the public invite preview, per IP
  funnel: { cap: 120, per: HOUR },     // first-party funnel counts, per IP
  err: { cap: 30, per: 10 * MIN },     // client error reports, per IP
  auth: { cap: 20, per: 10 * MIN },    // Google sign-in attempts, per IP
};

function classes(env = process.env) {
  const out = {}; for (const k in CLASSES) out[k] = { ...CLASSES[k] };
  if (env.RATE_LIMITS) { try { const o = JSON.parse(env.RATE_LIMITS); for (const k in o) out[k] = { ...(out[k] || { cap: 60, per: MIN }), ...o[k] }; } catch (e) { console.warn('RATE_LIMITS is not JSON; using defaults'); } }
  return out;
}

class Limiter {
  constructor({ clock = Date.now, limits = classes() } = {}) { this.clock = clock; this.limits = limits; this.b = new Map(); this.ops = 0; }
  // take(cls, who) → { ok, retryMs }: spends one token if there is one.
  take(cls, who, cost = 1) {
    const L = this.limits[cls]; if (!L) throw new Error('unknown rate class ' + cls);
    const t = this.clock(), key = cls + ':' + who, rate = L.cap / L.per;
    let b = this.b.get(key);
    if (!b) { b = { tokens: L.cap, at: t }; this.b.set(key, b); }
    else { b.tokens = Math.min(L.cap, b.tokens + Math.max(0, t - b.at) * rate); b.at = t; }
    if (++this.ops % 5000 === 0) this.prune(t);
    if (b.tokens >= cost) { b.tokens -= cost; return { ok: true, retryMs: 0 }; }
    return { ok: false, retryMs: Math.ceil((cost - b.tokens) / rate) };
  }
  // Drop buckets that have refilled completely: they behave exactly like a fresh one.
  prune(t = this.clock()) {
    for (const [key, b] of this.b) { const L = this.limits[key.slice(0, key.indexOf(':'))]; if (!L || b.tokens + (t - b.at) * L.cap / L.per >= L.cap) this.b.delete(key); }
  }
}

// Which classes a store write spends, beyond the per-user and per-IP write buckets. `exists` is whether the
// doc was there before (only creating something new counts towards the content caps).
function writeClasses(op, p, data, exists) {
  if (op !== 'set' || exists) return [];
  const s = p.split('/'), out = [];
  if (s[s.length - 2] === 'msgs') out.push('msg');
  if (s[0] === 'posts' && s.length === 2) out.push('post');
  if (s[0] === 'calls' && s.length === 2) out.push('call');
  if (s[0] === 'circles' && s.length === 4) {
    if (s[2] === 'dares' && data && data.to) out.push('dare');
    if (s[2] === 'midnight') out.push('midnight');
    if (s[2] === 'clips') out.push('clip');
  }
  return out;
}

// The address a request comes from. Behind Render's proxy the socket is the proxy, so TRUST_PROXY=1 reads
// the client from X-Forwarded-For (its first hop). Never trust the header without the flag: anyone can send it.
function clientIp(req, env = process.env) {
  if (env.TRUST_PROXY === '1') { const x = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (x) return x; }
  return req.socket.remoteAddress || 'unknown';
}

module.exports = { Limiter, CLASSES, classes, writeClasses, clientIp };
