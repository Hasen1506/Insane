// First-party funnel counts (C101), privacy by construction (DPDP purpose limitation):
//  - Only aggregate counts per (day, step) are stored. No uid, email, IP, device or session is kept.
//  - "Unique per day" uses a hash of (who, step) keyed with a random salt that lives in memory for one day
//    only; the dedupe rows are deleted when the day rolls over, so a hash can't be linked across days, and
//    after a restart a new salt means at worst a double count, never a stored identity.
//  - Steps are a fixed allowlist; anything else is dropped. The day is the DEFAULT_TZ calendar day.
'use strict';
const crypto = require('node:crypto');
const { dayKey } = require('./tz');

// welcome → email → code → name → place → circle → first action → day-1 return → invite sent → invitee joined
const STEPS = ['welcome', 'email', 'code', 'name', 'place', 'circle', 'first_action', 'day1_return', 'invite_sent', 'invite_joined'];

function createFunnel(db, { clock = Date.now, tz } = {}) {
  let salt = { day: null, key: null };
  const inc = db.prepare('INSERT INTO funnel(day,step,n) VALUES(?,?,1) ON CONFLICT(day,step) DO UPDATE SET n=n+1');
  const seen = db.prepare('INSERT OR IGNORE INTO funnel_seen(day,h) VALUES(?,?)');
  const purge = db.prepare('DELETE FROM funnel_seen WHERE day<>?');
  function today() {
    const d = dayKey(clock(), tz);
    if (salt.day !== d) { salt = { day: d, key: crypto.randomBytes(32) }; purge.run(d); }
    return d;
  }
  return {
    STEPS,
    // count(step, who): who is any stable string for "this person/browser today" (uid, or an anonymous
    // per-browser id the client sends); it is hashed with today's salt and never stored in the clear.
    count(step, who) {
      if (!STEPS.includes(step)) return false;
      const d = today();
      if (who) { const h = crypto.createHmac('sha256', salt.key).update(step + '\0' + String(who)).digest('base64url').slice(0, 22); if (seen.run(d, h).changes === 0) return false; }
      inc.run(d, step); return true;
    },
    // {days: [{day, steps: {step: n}}]} newest first, for the owner's Stats view.
    report(days = 30) {
      const rows = db.prepare('SELECT day,step,n FROM funnel ORDER BY day DESC').all(), by = new Map();
      for (const r of rows) { if (!by.has(r.day)) { if (by.size >= days) break; by.set(r.day, {}); } by.get(r.day)[r.step] = r.n; }
      const out = [...by].map(([day, steps]) => ({ day, steps }));
      const total = {}; for (const d of out) for (const [k, n] of Object.entries(d.steps)) total[k] = (total[k] || 0) + n;
      return { steps: STEPS, total, days: out };
    },
  };
}

module.exports = { createFunnel, STEPS };
