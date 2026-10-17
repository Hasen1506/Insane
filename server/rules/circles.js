// Rules for circles/{cid} (the circle doc itself). New in v0.9 (WS-I; WS-D's admin rules (C35) belong here too).
// On create the server stamps the creator as admin (C35 data) and the circle's time zone (C102): the tz the
// client sends if it is a real IANA zone, else the creator's last seen tz, else DEFAULT_TZ. Only an admin
// (or the owner) can change roles or tz afterwards; v0.8 clients only ever add themselves to `members`.
'use strict';
const { validTz, zoneOr } = require('../tz');
module.exports = ({ getDoc, isOwner }) => ({
  write(op, p, s, data, u, old) {
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
  },
});
