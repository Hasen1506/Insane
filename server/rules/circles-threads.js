// Rules for circles/{cid}/threads/{id}, moved verbatim from server.js beforeWrite()/readFilter() (v0.9 WS-I split, PLAN §3).
// write(op, p, s, data, u, old) returns the data to store (or throws Refuse); read(p, s, d, u) filters a doc for u.
'use strict';
module.exports = ({ getDoc, kv, now, isOwner, Refuse, balanceOf, MIN }) => ({
  write(op, p, s, data, u, old) {
    // Threads: pledges and plan answers are your own; only the organiser confirms a payment landed.
    if (s[0] === 'circles' && s[2] === 'threads' && s.length === 4 && op === 'update' && old) {
      data = { ...data };
      if (data.pledges) data.pledges = u.uid in data.pledges ? { [u.uid]: !!data.pledges[u.uid] } : {};
      if (data.going) data.going = u.uid in data.going ? { [u.uid]: !!data.going[u.uid] } : {};
      if (data.paid) { const pd = {}; for (const [k, v] of Object.entries(data.paid)) { if (v === 'wait' && k === u.uid) pd[k] = 'wait'; else if (v === true && old.by === u.uid) pd[k] = true; } data.paid = pd; }
      if (data.via) data.via = { [u.uid]: String(data.via[u.uid] || '').slice(0, 20) };
      if ('closed' in data && old.by !== u.uid) delete data.closed;
      if (old.by !== u.uid) { delete data.upi; delete data.pay; } // WS-G: only the organiser says where the money goes
      else if ('upi' in data) data.upi = /^[a-z0-9][a-z0-9._-]{1,63}@[a-z][a-z0-9]{1,31}$/i.test(String(data.upi)) ? String(data.upi) : ''; // WS-G: a UPI ID (name@bank) or nothing
      return data;
    }
    return data;
  },
});
