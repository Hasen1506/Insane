// Rules for circles/{cid} (the circle doc itself). New in v0.9 (WS-I; WS-D's admin rules (C35) belong here too).
// On create the server stamps the creator as admin (C35 data) and the circle's time zone (C102): the tz the
// client sends if it is a real IANA zone, else the creator's last seen tz, else DEFAULT_TZ. Only an admin
// (or the owner) can change roles or tz afterwards; v0.8 clients only ever add themselves to `members`.
'use strict';
const { validTz, zoneOr } = require('../tz');
module.exports = ({ getDoc, isOwner, safe }) => {
  // WS-D (C35, server/moderation.js) decides what a write may change: on create the name, code, city, owner and
  // members; afterwards only the name (owner), verified marks, never members/owner/removed/code. WS-I's rule
  // below then stamps admin roles and the circle's tz (C102) on create, and lets an admin change roles or tz.
  const rule = { write(op, p, s, data, u, old) {
    if (s.length !== 2) return data;
    const sd = safe().beforeWrite(op, p, data, u, old); // throws on delete: closing is the owner's route
    const own = roles(op, p, s, data, u, old);
    if (sd === undefined) return own;
    if (op === 'set' && !old) return { ...sd, by: own.by, roles: own.roles, tz: own.tz, tzFrom: own.tzFrom };
    for (const k of ['roles', 'tz']) if (k in data && k in own) sd[k] = own[k];
    return sd;
  } };
  function roles(op, p, s, data, u, old) {
    if (s.length !== 2 || op === 'delete') return data;
    const admin = !!old && ((old.roles || {})[u.uid] === 'admin' || (!old.roles && old.by === u.uid));
    if (op === 'set' && !old) {
      const me = getDoc('people/' + u.uid) || {};
      const tz = validTz(data.tz) ? data.tz : zoneOr(me.tz);
      return { ...data, by: u.uid, roles: { [u.uid]: 'admin' }, tz, tzFrom: validTz(data.tz) ? 'client' : validTz(me.tz) ? 'creator' : 'default' };
    }
    data = { ...data };
    if ('roles' in data && !(admin || isOwner(u))) delete data.roles;
    if ('tz' in data && !((admin || isOwner(u)) && validTz(data.tz))) delete data.tz;
    if (op === 'set' && old) for (const k of ['roles', 'tz', 'tzFrom', 'by']) if (!(k in data) && k in old) data[k] = old[k]; // a set never drops them
    return data;
  }
  return rule;
};
