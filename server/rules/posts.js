// Rules for posts/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN, safe }) => ({
  write(op, p, s, data, u, old) {
    { const sd = safe().beforeWrite(op, p, data, u, old); if (sd !== undefined) return sd; } // WS-D (server/moderation.js): dare screen and flags, blocks
    if (s[0] === 'posts' && s.length === 2 && old && old.by !== u.uid && !isOwner(u)) {
      if (op !== 'update') throw new Refuse('permission_denied', 'Not your post.');
      const keep = {};
      if ('flags' in data) keep.flags = [...new Set([...(old.flags || []), u.uid])];
      if (data.reacts && u.uid in data.reacts) { const r = data.reacts[u.uid]; keep.reacts = { [u.uid]: r && ['love', 'in', 'steal'].includes(r.r) ? { r: r.r, circle: String(r.circle || ''), cname: String(r.cname || '').slice(0, 28) } : null }; }
      return keep;
    }
    return data;
  },
});
