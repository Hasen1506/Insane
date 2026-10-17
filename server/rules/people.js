// Rules for people/{uid}. New in v0.9 (WS-I, C36 data; WS-D's member rules belong here too).
// Expand phase of expand → migrate → contract (C99): v0.8 clients write `circle` (one circle); v0.9 keeps
// `circles: [cid]` (up to MAX_CIRCLES, default 3) and mirrors every `circle` write into it, so both shapes
// stay true for one release. `circle` stays the primary (first) circle.
'use strict';
const MAX = () => Math.max(1, +process.env.MAX_CIRCLES || 3);
const ID = /^[A-Za-z0-9_\-:.@]{1,64}$/;
module.exports = ({ Refuse }) => ({
  write(op, p, s, data, u, old) {
    if (s.length !== 2 || op === 'delete') return data;
    if (op === 'update' && !('circle' in data) && !('circles' in data)) return data;
    const prev = old ? (Array.isArray(old.circles) ? old.circles : old.circle ? [old.circle] : []) : [];
    let cs = Array.isArray(data.circles) ? data.circles : op === 'set' ? [] : prev.slice();
    if ('circle' in data) {
      if (data.circle) cs = [data.circle, ...cs.filter(x => x !== data.circle)];
      else if (old && old.circle) cs = cs.filter(x => x !== old.circle);
    }
    cs = [...new Set(cs.filter(x => typeof x === 'string' && ID.test(x)))];
    if (cs.length > MAX() && cs.length > prev.length) throw new Refuse('failed_precondition', `You can be in up to ${MAX()} circles. Leave one first.`);
    const out = { ...data, circles: cs };
    if ('circles' in data && !('circle' in data) && !(old && old.circle && cs.includes(old.circle))) out.circle = cs[0] || null;
    return out;
  },
});
