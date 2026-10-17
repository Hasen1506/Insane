// Rules for circles/{cid}/clips/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    if (s[0] === 'circles' && s[2] === 'clips' && s.length === 4) {
      if (op === 'set') { if (old || data.by !== u.uid) throw new Refuse('permission_denied', 'Post clips as yourself.'); if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data.img || '') || data.img.length > 200000) throw new Refuse('invalid_argument', 'Not a photo.'); return { by: u.uid, what: String(data.what || '').slice(0, 80), note: String(data.note || '').slice(0, 120), img: data.img, at: now(), exp: now() + 24 * 3600e3, seen: {} }; }
      if (op === 'update') return data.seen && u.uid in data.seen ? { seen: { [u.uid]: true } } : {};
      if (old && old.by !== u.uid && old.exp > now() && !isOwner(u)) throw new Refuse('permission_denied', 'Not your clip.');
      return data;
    }
    return data;
  },
});
