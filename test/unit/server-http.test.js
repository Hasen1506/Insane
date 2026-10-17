// WS-I over real HTTP: security headers (C85), body cap and write limits (C84, P19 wiring), the public invite
// preview (C11), /api/dev/tick (§5.0), unlocks (C25), circle tz on create (C102), multi-circle mirror (C36),
// the funnel stores no identity (C101), Google sign-in against a mocked tokeninfo (C14), Sentry envelopes
// scrubbed and a no-op without a DSN (C98), and the build headers (C08).
'use strict';
const { DatabaseSync } = require('node:sqlite');
const { start, fake } = require('../lib/server-proc');
const { securityHeaders, buildCsp } = require('../../server/headers');
const { scrub, parseDsn, createSentry } = require('../../server/sentry');

module.exports = async function (t) {
  // pure: HSTS only behind https, CSP covers the tile origin and forbids framing and plugins
  const sh = securityHeaders({ secure: true, tileUrl: 'https://tiles.example.com/{z}/{x}/{y}.png' }), plain = securityHeaders({ secure: false });
  t.ok('HSTS is sent behind https and not on plain http', /max-age=31536000/.test(sh['strict-transport-security']) && !plain['strict-transport-security']);
  t.ok('CSP allows the tile origin for img and connect, forbids objects and framing', /img-src [^;]*https:\/\/tiles\.example\.com/.test(sh['content-security-policy']) && /connect-src [^;]*https:\/\/tiles\.example\.com/.test(sh['content-security-policy']) && /object-src 'none'/.test(sh['content-security-policy']) && /frame-ancestors 'none'/.test(sh['content-security-policy']));
  t.ok('CSP_EXTRA appends sources', /connect-src [^;]*https:\/\/o1\.ingest\.sentry\.io/.test(buildCsp({ extra: 'connect-src https://o1.ingest.sentry.io' })));

  const sentrySeen = await fake(() => ({ body: '{}' }));
  const google = await fake(req => {
    const tok = new URL(req.url, 'http://x').searchParams.get('id_token');
    const ok = { aud: 'test-client.apps.googleusercontent.com', iss: 'https://accounts.google.com', email: 'Priya@Example.in', email_verified: 'true', exp: String(Math.floor(Date.now() / 1000) + 600) };
    if (tok === 'aaa.good.sig') return { body: JSON.stringify(ok) };
    if (tok === 'aaa.otheraud.sig') return { body: JSON.stringify({ ...ok, aud: 'someone-else' }) };
    return { status: 400, body: '{"error":"invalid_token"}' };
  });
  const S = await start({ env: { SENTRY_DSN: `http://pubkey@${sentrySeen.url.slice(7)}/42`, GOOGLE_CLIENT_ID: 'test-client.apps.googleusercontent.com', GOOGLE_TOKENINFO_URL: google.url, MIN_CLIENT_BUILD: 'abc123', RATE_LIMITS: JSON.stringify({ write: { cap: 60, per: 60000 }, post: { cap: 3, per: 3600000 } }) } });
  try {
    /* headers */
    const r = await fetch(S.url + '/'), h = r.headers;
    t.ok('index.html carries CSP, nosniff, Referrer-Policy, Permissions-Policy geolocation=(self), X-Frame-Options, COOP', /default-src 'self'/.test(h.get('content-security-policy')) && h.get('x-content-type-options') === 'nosniff' && h.get('referrer-policy') === 'strict-origin-when-cross-origin' && /geolocation=\(self\)/.test(h.get('permissions-policy')) && h.get('x-frame-options') === 'DENY' && h.get('cross-origin-opener-policy') === 'same-origin', [...h].join(' | ').slice(0, 400));
    const hh = (await S.get('hello')).headers;
    t.ok('API responses carry X-Insane-Build and X-Insane-Min-Build (C08) and the security headers', /^[0-9a-f]{6,}|dev$/.test(hh.get('x-insane-build')) && hh.get('x-insane-min-build') === 'abc123' && !!hh.get('content-security-policy'));
    t.ok('no HSTS on a plain-http dev server', !h.get('strict-transport-security'));
    const a = await S.signIn('arjun@example.in'), k = await S.signIn('kavya@example.in');
    /* body cap */
    const big = await S.post('set', JSON.stringify({ path: 'people/' + a, data: { name: 'x'.repeat(1024 * 1024) } }), 'arjun@example.in');
    t.ok('a 1 MB body is refused with 413 payload_too_large', big.status === 413 && big.body.code === 'payload_too_large', big.status);
    /* onboarding + circle create: tz and roles stamped by the server */
    await S.post('set', { path: 'people/' + a, data: { name: 'Arjun Kumar', circle: null, adult: true, consent: { v: '2026-10-draft' }, tz: 'Asia/Kolkata', joined: Date.now() } }, 'arjun@example.in');
    await S.post('set', { path: 'people/' + k, data: { name: 'كافيا Kavya', circle: null, adult: true, consent: { v: '2026-10-draft' }, tz: 'Europe/Lisbon', joined: Date.now() } }, 'kavya@example.in');
    await S.post('set', { path: 'codes/MAD8HT', data: { cid: 'c1', at: Date.now() } }, 'arjun@example.in');
    await S.post('set', { path: 'circles/c1', data: { name: 'Mylapore Mad Hatters', code: 'MAD8HT', members: [a], by: 'someone-else' } }, 'arjun@example.in');
    const c1 = (await S.post('get', { path: 'circles/c1' }, 'arjun@example.in')).body.doc;
    t.ok('a new circle gets tz from its creator, the creator as admin, and by = the writer', c1.tz === 'Asia/Kolkata' && c1.tzFrom === 'creator' && c1.roles[a] === 'admin' && c1.by === a, JSON.stringify(c1));
    await S.post('update', { path: 'people/' + a, data: { circle: 'c1' } }, 'arjun@example.in');
    // int-1: since WS-D, joining is people/{uid}.circle (the server keeps members in step); a raw members write is ignored
    await S.post('update', { path: 'people/' + k, data: { circle: 'c1' } }, 'kavya@example.in');
    await S.post('update', { path: 'circles/c1', data: { members: [a, k, 'u_stranger'], roles: { [k]: 'admin' }, tz: 'Europe/Lisbon' } }, 'kavya@example.in');
    const c1b = (await S.post('get', { path: 'circles/c1' }, 'kavya@example.in')).body.doc;
    t.ok('a member can join (people.circle → members) but not make themselves admin or move the circle’s zone', c1b.members.length === 2 && !c1b.roles[k] && c1b.tz === 'Asia/Kolkata', JSON.stringify(c1b));
    const pk = (await S.post('get', { path: 'people/' + k }, 'kavya@example.in')).body.doc;
    t.ok('a v0.8 `circle` write is mirrored into circles: [cid] (C36 expand)', JSON.stringify(pk.circles) === '["c1"]' && pk.circle === 'c1', JSON.stringify(pk));
    const four = await S.post('update', { path: 'people/' + k, data: { circles: ['c1', 'c2', 'c3', 'c4'] } }, 'kavya@example.in');
    t.ok('a fourth circle is refused (MAX_CIRCLES 3)', four.status === 400 && four.body.code === 'failed_precondition', JSON.stringify(four.body));
    /* invite preview */
    const inv = await S.get('invite/mad8ht');
    t.ok('GET /api/invite/:code (signed out) gives the name, size and first names only', inv.status === 200 && inv.body.name === 'Mylapore Mad Hatters' && inv.body.members === 2 && inv.body.by === 'Arjun' && JSON.stringify(inv.body.names) === '["Arjun","كافيا"]' && !JSON.stringify(inv.body).includes(a) && !/tz|cell|lat/.test(JSON.stringify(inv.body)), JSON.stringify(inv.body));
    t.ok('an unknown code is a 404', (await S.get('invite/ZZZZZZ')).status === 404);
    /* Midnight in the circle's zone */
    const ask = Date.now() + 3 * 36e5;
    await S.post('set', { path: 'circles/c1/midnight/m1', data: { text: 'about me', releaseAt: ask } }, 'kavya@example.in');
    const m1 = (await S.post('query', { col: 'circles/c1/midnight' }, 'arjun@example.in')).body.docs[0].data;
    const ist = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(m1.releaseAt));
    t.ok('a Midnight message from a Lisbon phone is released at 00:00 circle time (Chennai)', ist === '00:00' && m1.releaseAt > Date.now() && m1.text === null, ist + ' ' + m1.releaseAt);
    /* dev tick releases it */
    const off = m1.releaseAt + 5000 - Date.now();
    const tick = (await S.post('dev/tick', { offset: off })).body;
    const m1b = (await S.post('query', { col: 'circles/c1/midnight' }, 'arjun@example.in')).body.docs[0].data;
    const log = (await S.get('dev/pushlog')).body.log;
    t.ok('POST /api/dev/tick moves the clock, runs the sweep at once and reports it', tick.now >= m1.releaseAt && tick.notes >= 1 && m1b.text === 'about me' && log.some(l => l.title === 'Midnight'), JSON.stringify(tick));
    await S.post('dev/clock', { offset: 0 });
    /* unlocks */
    const un = (await S.get('unlocks', 'arjun@example.in')).body;
    t.ok('GET /api/unlocks: 2 members, day 0 → no Midnight yet, with a reason', un.circle === 'c1' && un.inputs.members === 2 && !un.on.includes('midnight') && /3 members/.test(un.locked.midnight), JSON.stringify(un));
    t.ok('/api/unlocks needs a session', (await S.get('unlocks')).status === 401);
    /* write limits: per-user content cap and the general write bucket */
    const posts = []; for (let i = 0; i < 4; i++) posts.push(await S.post('set', { path: 'posts/p' + i, data: { by: a, text: 'hi ' + i } }, 'arjun@example.in'));
    t.ok('the 4th new post in an hour is refused 429 with Retry-After (post cap 3)', posts.slice(0, 3).every(p => p.status === 200) && posts[3].status === 429 && posts[3].body.code === 'resource_exhausted' && +posts[3].headers.get('retry-after') > 0, posts.map(p => p.status).join(','));
    const ws = []; for (let i = 0; i < 70; i++) ws.push((await S.post('update', { path: 'people/' + k, data: { seen: i } }, 'kavya@example.in')).status);
    const firstRefused = ws.indexOf(429);
    t.ok('per-user writes: a burst passes up to the bucket and the next is refused (60/min)', firstRefused >= 50 && firstRefused <= 61 && ws.slice(0, firstRefused).every(s => s === 200), `first 429 at ${firstRefused}`);
    t.ok('another user is unaffected by that flood', (await S.post('update', { path: 'people/' + a, data: { seen: 1 } }, 'arjun@example.in')).status === 200);
    /* funnel: counted once per person per day, nothing identifying stored */
    const f1 = (await S.post('funnel', { step: 'welcome', anon: 'browser-1' })).body, f2 = (await S.post('funnel', { step: 'welcome', anon: 'browser-1' })).body, f3 = (await S.post('funnel', { step: 'not-a-step' })).body;
    t.ok('funnel: an allowlisted step counts once per browser per day; unknown steps are dropped', f1.counted && !f2.counted && !f3.counted);
    const rep = await S.get('funnel', 'arjun@example.in');
    t.ok('funnel report is owner-only', rep.status === 403);
    await S.signIn('owner@example.com');
    const rep2 = (await S.get('funnel', 'owner@example.com')).body;
    t.ok('funnel counts email, code, name, circle, welcome from real flows', rep2.total.email >= 3 && rep2.total.code >= 3 && rep2.total.name >= 2 && rep2.total.circle === 1 && rep2.total.welcome === 1, JSON.stringify(rep2.total));
    { const d = new DatabaseSync(S.db, { readOnly: true }); const dumpRows = JSON.stringify([...d.prepare('SELECT * FROM funnel').all(), ...d.prepare('SELECT * FROM funnel_seen').all()]); d.close();
      t.ok('the funnel tables hold no uid, email or browser id', !dumpRows.includes(a) && !dumpRows.includes(k) && !/@|browser-1|u_/.test(dumpRows), dumpRows.slice(0, 300)); }
    /* Google sign-in (mocked tokeninfo) */
    const g1 = await S.post('auth/google', { credential: 'aaa.good.sig' });
    t.ok('Google sign-in with a valid token for this client signs in (lower-cased email) and sets the cookie', g1.status === 200 && /^u_/.test(g1.body.uid) && /insane_s=/.test(g1.headers.get('set-cookie')), JSON.stringify(g1.body));
    t.ok('a token for another client id is refused', (await S.post('auth/google', { credential: 'aaa.otheraud.sig' })).status === 403);
    t.ok('a token Google rejects is refused', (await S.post('auth/google', { credential: 'aaa.bad.sig' })).status === 400);
    t.ok('hello advertises the Google client id', (await S.get('hello')).body.google === 'test-client.apps.googleusercontent.com');
    /* Sentry: client errors go out as scrubbed envelopes */
    const e1 = await S.post('err', { message: 'boom for kavya@example.in at 13.0827, 80.2707 from 10.1.2.3', stack: 'Error: x\n    at act (index.html:12:3)', path: '/#cMAD8HT?x=1' });
    await require('../lib/e2e').until(() => sentrySeen.reqs.length > 0, { timeout: 5000, what: 'a Sentry envelope' }).catch(() => { });
    const env = sentrySeen.reqs[0];
    const body = env ? env.body.toString() : '';
    t.ok('POST /api/err forwards one envelope to the DSN’s project with sentry_key auth', e1.body.sent === true && env && env.url === '/api/42/envelope/' && /sentry_key=pubkey/.test(env.headers['x-sentry-auth']) && body.split('\n').length >= 3, env ? env.url : 'none');
    t.ok('the envelope carries no email, coordinates or IP', body && !/kavya@example\.in|13\.0827|80\.2707|10\.1\.2\.3/.test(body) && /\[email\]/.test(body), body.slice(0, 300));
  } finally { await S.stop(); await sentrySeen.close(); await google.close(); }

  /* Sentry pure */
  t.ok('scrub removes emails, IPs, coordinates, cookies and codes, and drops identifying keys', JSON.stringify(scrub({ m: 'a@b.co 192.168.0.1 "lat": 13.08 insane_s=abc 123456', email: 'x', user: { id: 1 }, lat: 1 })) === JSON.stringify({ m: '[email] [ip] "lat": [coord] insane_s=[cookie] [code]' }), JSON.stringify(scrub({ m: 'a@b.co 192.168.0.1 "lat": 13.08 insane_s=abc 123456' })));
  t.ok('a DSN parses to its envelope URL', parseDsn('https://k@o1.ingest.sentry.io/77').envelope === 'https://o1.ingest.sentry.io/api/77/envelope/' && parseDsn('') === null && parseDsn('nonsense') === null);
  { let called = 0; const s = createSentry({ dsn: '', fetchImpl: () => { called++; } }); const r = await s.captureException(new Error('x')); t.ok('without SENTRY_DSN capture is a no-op (no network)', r === false && called === 0 && !s.enabled); }
};
