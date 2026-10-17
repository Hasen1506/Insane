// Rules for circles/{cid}/midnight/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
const { validTz, nearestMidnight, nextMidnight } = require('../tz');
// C102 (WS-I): a release lands on 00:00 in the circle's time zone, not the sender's device zone. The night the
// client asked for (tonight / tomorrow / a night this week) is read as the circle-zone midnight nearest to it.
function circleMidnight(getDoc, cid, at, t, MIN) {
  const c = getDoc('circles/' + cid), tz = c && c.tz;
  if (!validTz(tz)) return at;
  const m = nearestMidnight(at, tz);
  return m >= t + MIN ? m : nextMidnight(t + MIN, tz);
}
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'circles' && s[2] === 'midnight' && s.length === 4) {
      if (op === 'set') return { text: String(data.text || '').slice(0, 400), releaseAt: circleMidnight(getDoc, s[1], Math.max(+data.releaseAt || 0, now() + MIN), now(), MIN), flags: [] }; // no author, by construction
      if (op === 'update') {
        const keep = {};
        if ('flags' in data) keep.flags = [...new Set([...(old?.flags || []), u.uid])];
        if (data.reacts && u.uid in data.reacts) { const r = data.reacts[u.uid]; keep.reacts = { [u.uid]: ['same', 'brave', '❤'].includes(r) ? r : null }; }
        if (data.removed === true) keep.removed = true;
        return keep;
      }
    }
    return data;
  },
  read(p, s, d, u) {
    if (s[0] === 'circles' && s[2] === 'midnight' && d.releaseAt > now()) d = { ...d, text: null };
    return d;
  },
});
