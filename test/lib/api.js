// A DEV server and signed-in API clients, for tests that speak HTTP without a browser (WS-E).
//   const A = await api.open({ port });  const u = await A.user('meera@x.in');  await u.post('set', {...})
// Every response body and every SSE message any client receives is kept in A.seen, so a test can scan
// all of them (P08: no Decode answer in any payload).
'use strict';
const E = require('./e2e');
async function open({ port = 0, owner = 'owner@x.com', env = {} } = {}) {
  port = port || 8800 + Math.floor(Math.random() * 900);
  const srv = await E.startServer({ port, owner, env: { SEED: 'test-seed', ...env } });
  const base = srv.url, seen = [];
  const keep = (where, body) => { seen.push({ where, body }); return body; };
  async function user(email) {
    let cookie = '';
    const req = async (method, r, body) => {
      const res = await fetch(base + '/api/' + r, { method, headers: { 'content-type': 'application/json', cookie }, body: body === undefined ? undefined : JSON.stringify(body) });
      const sc = res.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
      const text = await res.text(); keep(email + ' ' + method + ' ' + r, text);
      let j = null; try { j = JSON.parse(text); } catch (e) { }
      return { status: res.status, body: j, text };
    };
    await req('POST', 'auth/start', { email });
    const code = await E.outboxCode(base, email);
    const v = await req('POST', 'auth/verify', { email, code });
    const u = { email, uid: v.body.uid, get: (r) => req('GET', r), post: (r, b) => req('POST', r, b || {}), cookie: () => cookie };
    // an SSE stream with subscriptions; every message lands in seen
    u.stream = async (specs) => {
      const cid = 'c' + Math.random().toString(36).slice(2, 10), ctl = new AbortController(), msgs = [];
      const res = await fetch(base + '/api/stream?cid=' + cid, { headers: { cookie }, signal: ctl.signal });
      const rd = res.body.getReader(), dec = new TextDecoder(); let buf = '';
      (async () => { try { for (; ;) { const { value, done } = await rd.read(); if (done) break; buf += dec.decode(value, { stream: true }); let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); const m = /^data: (.*)$/m.exec(chunk); if (m) { msgs.push(m[1]); keep(email + ' SSE', m[1]); } } } } catch (e) { } })();
      let n = 0; for (const spec of specs) await req('POST', 'sub', { cid, sub: 's' + (n++), spec });
      return { msgs, close: () => ctl.abort() };
    };
    return u;
  }
  const clock = t => fetch(base + '/api/dev/clock', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ offset: t - Date.now() }) }).then(r => r.json());
  const answer = (city, week) => fetch(`${base}/api/dev/decode?city=${encodeURIComponent(city)}&week=${encodeURIComponent(week)}`).then(r => r.json());
  return { base, srv, seen, user, clock, answer, close: () => srv.close() };
}
module.exports = { open };
