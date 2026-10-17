// Rules for drops/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
const crypto = require('node:crypto');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
// Drops (WS-E, C50): commit-reveal. The server picks the draw seed when the drop is made and publishes only
// its hash; the seed itself is kept aside (kv dropseed:<id>) and goes into the drop when it closes (sweep, and
// read() for anyone reading after the end), so nobody (host included) can know the winner beforehand.
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'drops' && s.length === 2) {
      if (op === 'delete') { if (old && old.host !== u.uid && !isOwner(u)) throw new Refuse('permission_denied', 'Only the host can cancel a drop.'); return data; }
      if (old && old.host !== u.uid) { const keep = {}; for (const k of ['item', 'swaps']) if (k in data) keep[k] = data[k]; return keep; }
      data = { ...data }; delete data.seed; delete data.seedHash; delete data.hostCircle; // the server's, never the host's
      if (op === 'set' && !old) {
        const seed = crypto.randomBytes(16).toString('hex'); kv.set('dropseed:' + s[1], seed);
        data.seedHash = sha(seed); data.host = u.uid; data.hostCircle = (getDoc('people/' + u.uid) || {}).circle || null;
        return data;
      }
      if (op === 'set') { data.host = u.uid; for (const k of ['seed', 'seedHash', 'hostCircle']) if (k in old) data[k] = old[k]; return data; } // re-saving can't re-roll
      return data;
    }
    return data;
  },
  read(p, s, d, u) {
    if (s[0] === 'drops' && d.host !== u.uid) { d = { ...d }; delete d.code; }
    if (s[0] === 'drops' && d.seedHash && !d.seed && now() >= d.end) { const seed = kv.get('dropseed:' + s[1]); if (seed) d = { ...d, seed }; }
    return d;
  },
});
