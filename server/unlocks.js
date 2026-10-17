// Server-computed gradual unlocks (C25), a pure function so the client (WS-B) and tests share one rule.
// Inputs only ever grow (members joined, days since join, met in person, a first plan made), and every
// feature's condition is monotonic in them, so a feature never locks again (PBT P20) — except members,
// which can fall when someone leaves: a feature unlocked by size stays unlocked once reached (`ever`).
'use strict';
const RULES = [
  // [feature, unlocked when, the reason shown while locked]
  ['plans', () => true, ''],
  ['chat', () => true, ''],
  ['pacts', () => true, ''],
  ['daily', () => true, ''],
  ['decode', () => true, ''],
  ['favors', x => x.plans >= 1, 'Unlocks after your circle’s first plan'],
  ['pots', x => x.plans >= 1, 'Unlocks after your circle’s first plan'],
  ['midnight', x => x.maxMembers >= 3, 'Unlocks at 3 members'],
  ['mole', x => x.maxMembers >= 4, 'Unlocks at 4 members'],
  ['feed', x => x.met, 'Unlocks once you’ve met someone in person'],
  ['calls', x => x.met, 'Unlocks once you’ve met someone in person'],
  ['missions', x => x.met, 'Unlocks once you’ve met someone in person'],
  ['drops', x => x.days >= 3, 'Unlocks on day 3'],
  ['trails', x => x.days >= 3, 'Unlocks on day 3'],
];
const FEATURES = RULES.map(r => r[0]);

// x: {members, maxMembers?, days, met, plans}. Returns {on: [feature], locked: {feature: reason}}.
function unlocks(x = {}) {
  const n = { members: Math.max(0, +x.members || 0), days: Math.max(0, +x.days || 0), met: !!x.met, plans: Math.max(0, +x.plans || 0) };
  n.maxMembers = Math.max(n.members, +x.maxMembers || 0);
  const on = [], locked = {};
  for (const [f, ok, why] of RULES) if (ok(n)) on.push(f); else locked[f] = why;
  return { on, locked };
}

module.exports = { unlocks, FEATURES };
