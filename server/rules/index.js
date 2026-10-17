// Storage rules, one file per collection (PLAN-V09 §3: WS-I splits rules() first; WS-D and WS-E then own their files).
// A doc path picks its file by key: the top collection ('drops'), or 'circles-<sub>' for circles/{cid}/<sub>/…
// Each file is `ctx => ({ write(op, p, s, data, u, old), read(p, s, d, u) })`, both optional; a missing file
// or hook passes data through unchanged, as v0.8's beforeWrite()/readFilter() did for unlisted paths.
// To add a collection, drop a file here: every *.js in this folder except index.js is loaded.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const keyOf = s => s[0] === 'circles' && s.length >= 3 ? 'circles-' + s[2] : s[0];
module.exports = function loadRules(ctx) {
  const R = Object.create(null);
  for (const f of fs.readdirSync(__dirname).filter(f => f.endsWith('.js') && f !== 'index.js').sort()) R[f.slice(0, -3)] = require(path.join(__dirname, f))(ctx);
  return {
    files: Object.keys(R),
    beforeWrite(op, p, data, u) {
      const s = p.split('/'), old = ctx.getDoc(p), r = R[keyOf(s)];
      return r && r.write ? r.write(op, p, s, data, u, old) : data;
    },
    readFilter(p, d, u) {
      if (!d) return d;
      const s = p.split('/'), r = R[keyOf(s)];
      return r && r.read ? r.read(p, s, d, u) : d;
    },
  };
};
