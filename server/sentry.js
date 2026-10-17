// Optional Sentry error reporting (C98), no SDK and no dependencies: one envelope POST per error.
// SENTRY_DSN unset → every call is a no-op. SENTRY_ENV names the environment, the release is the BUILD_ID.
// Nothing personal leaves the server: emails, IPs, coordinates, cookies, codes and tokens are scrubbed from
// every string, and no user id, IP or request body is attached. Reports are capped (SENTRY_MAX_PER_MIN, 20).
'use strict';
const crypto = require('node:crypto');

function parseDsn(dsn) {
  if (!dsn) return null;
  try {
    const u = new URL(dsn), project = u.pathname.replace(/^\/+|\/+$/g, '').split('/').pop();
    if (!u.username || !project) return null;
    const base = u.pathname.replace(/\/?[^/]*\/?$/, ''); // a DSN can carry a path prefix before the project id
    return { key: u.username, project, envelope: `${u.protocol}//${u.host}${base}/api/${project}/envelope/`, dsn };
  } catch (e) { return null; }
}

// Scrub anything that could identify a person or a place. Order matters: emails before generic tokens.
const RX = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]'],
  [/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi, '[ip]'],
  [/-?\d{1,3}\.\d{3,}\s*,\s*-?\d{1,3}\.\d{3,}/g, '[coords]'],          // "13.0827, 80.2707"
  [/("?(?:lat|lon|lng|latitude|longitude)"?\s*[:=]\s*)-?\d+(?:\.\d+)?/gi, '$1[coord]'],
  [/(insane_s=)[^;\s]+/g, '$1[cookie]'],
  [/\b(?:Bearer|vapid t=)\s*[A-Za-z0-9._~+/=-]+/g, '[token]'],
  [/\b\d{6}\b/g, '[code]'],                                             // sign-in codes
  [/\bu_[A-Za-z0-9_-]{10,}\b/g, '[uid]'],
  [/(\+?\d[\d\s-]{8,}\d)/g, '[phone]'],
];
function scrub(v, depth = 0) {
  if (typeof v === 'string') { let s = v; for (const [r, w] of RX) s = s.replace(r, w); return s.slice(0, 8000); }
  if (Array.isArray(v)) return depth > 6 ? [] : v.slice(0, 100).map(x => scrub(x, depth + 1));
  if (v && typeof v === 'object') {
    if (depth > 6) return {};
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (/^(email|ip|ip_address|cookie|cookies|authorization|lat|lon|lng|cell|code|token|user|uid|headers|data)$/i.test(k)) continue;
      o[k] = scrub(x, depth + 1);
    }
    return o;
  }
  return v;
}

function frames(stack) {
  return String(stack || '').split('\n').slice(1, 40).map(l => {
    const m = /at (?:(.+?) \()?(.*?):(\d+):(\d+)\)?$/.exec(l.trim()); if (!m) return null;
    return { function: m[1] || '?', filename: m[2].replace(/^.*\/(server|app|src)\//, '$1/'), lineno: +m[3], colno: +m[4], in_app: !/node:|node_modules/.test(m[2]) };
  }).filter(Boolean).reverse();
}

function eventFrom(err, { release, environment, platform = 'node', tags = {}, extra } = {}) {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  return scrub({
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: Date.now() / 1000,
    platform, level: 'error', release, environment,
    server_name: 'insane',
    tags,
    exception: { values: [{ type: e.name || 'Error', value: e.message, stacktrace: { frames: frames(e.stack) } }] },
    extra,
  });
}

function envelope(ev, dsn) {
  return [JSON.stringify({ event_id: ev.event_id, sent_at: new Date().toISOString(), dsn: dsn.dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(ev)].join('\n') + '\n';
}

function createSentry({ dsn = process.env.SENTRY_DSN, release = 'dev', environment = process.env.SENTRY_ENV || 'production', fetchImpl = globalThis.fetch, maxPerMin = +process.env.SENTRY_MAX_PER_MIN || 20 } = {}) {
  const D = parseDsn(dsn); let windowStart = 0, sent = 0;
  async function send(ev) {
    if (!D) return false;
    const t = Date.now(); if (t - windowStart > 6e4) { windowStart = t; sent = 0; } if (++sent > maxPerMin) return false;
    try {
      const r = await fetchImpl(D.envelope, { method: 'POST', headers: { 'content-type': 'application/x-sentry-envelope', 'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${D.key}, sentry_client=insane/0.9` }, body: envelope(ev, D) });
      return r.ok;
    } catch (e) { return false; } // monitoring must never take the server down
  }
  return {
    enabled: !!D,
    captureException: (err, opts = {}) => D ? send(eventFrom(err, { release, environment, ...opts })) : Promise.resolve(false),
    // A report the browser posted to /api/err, already shaped {message, stack, url}; scrubbed the same way.
    captureClient: (r = {}) => {
      if (!D) return Promise.resolve(false);
      const e = new Error(String(r.message || 'client error').slice(0, 500)); e.name = String(r.type || 'ClientError').slice(0, 60); e.stack = `${e.name}: ${e.message}\n${String(r.stack || '').slice(0, 6000)}`;
      return send(eventFrom(e, { release: String(r.build || release).slice(0, 40), environment, platform: 'javascript', tags: { side: 'client', path: String(r.path || '').replace(/[?#].*$/, '').slice(0, 80) } }));
    },
  };
}

module.exports = { createSentry, parseDsn, scrub, eventFrom, envelope };
