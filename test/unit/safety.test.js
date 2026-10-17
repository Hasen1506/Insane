// WS-D unit checks: the page and the server share one name screen; the legal pages exist and say what's missing.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const region = f => { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); const m = /\/\/ <names>[^\n]*\n([\s\S]*?)\/\/ <\/names>/.exec(s); return m ? m[1].trim() : null; };
module.exports = async function (t) {
  const a = region('server/names.js'), b = region('src/js/98-safety.js');
  t.ok('the Midnight name screen and dare screen are the same code in server/names.js and src/js/98-safety.js', a && a === b, a && b ? 'they differ: copy server/names.js between the <names> markers into 98-safety.js' : 'markers missing');
  for (const k of ['terms', 'privacy', 'rules']) {
    const f = path.join(ROOT, 'app', 'legal', k + '.html'), s = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    t.ok(`legal/${k}.html exists, is marked a draft, names the consent version and the grievance officer placeholder`, /Draft, not legal advice/.test(s) && /2026-10-draft/.test(s) && /Grievance officer/.test(s) && /needs Vijay/.test(s));
  }
  const { CONSENT_VERSION } = require(path.join(ROOT, 'server', 'moderation.js'));
  const page = fs.readFileSync(path.join(ROOT, 'src', 'js', '98-safety.js'), 'utf8');
  t.ok('the page and the server ask for the same consent version', page.includes(`const CONSENT_V='${CONSENT_VERSION}'`));
  const N = require(path.join(ROOT, 'server', 'names.js'));
  const refuse = ['Run across the road at rush hour', 'Drink a beer in one go', 'Climb the water tank', 'Kiss a stranger', 'Bet ₹500 you can do it', 'Set fire to a newspaper', 'Steal a spoon from the café', 'Prank call the police'];
  const pass = ['Order your coffee in the voice of a movie trailer', 'Compliment a stranger’s shoes, and mean it', 'Pay someone a compliment', 'Take five photos of doors', 'Sing on the street corner'];
  t.ok('the dare screen refuses traffic, alcohol, heights, strangers’ bodies, money, fire, the law', refuse.every(d => N.unsafeDare(d)), refuse.filter(d => !N.unsafeDare(d)).join(' | '));
  { const app = require(path.join(ROOT, 'test', 'lib', 'load.js')).loadV09(), real = Date.UTC(2026, 9, 17, 12);
    const res = [-864e5, 864e5, 14 * 864e5, 1500].map(off => { app.setNow(real + off); app.run(`setSkew(${real})`); const n = app.run('now()'), left = app.run(`left(${real + 3600e3}-now())`); return [Math.abs(n - real) < (Math.abs(off) > 5000 ? 50 : 2000), left]; });
    t.ok('C61 with the phone a day behind, a day ahead or a fortnight ahead, now() is the server’s and a 1 h dark shows 1h 00m', res.slice(0, 3).every(([a, l]) => a && /^(1h 00m|59:5\d)$/.test(l)) && res[3][0], JSON.stringify(res)); }
  t.ok('the dare screen lets ordinary dares through', pass.every(d => !N.unsafeDare(d)), pass.filter(d => N.unsafeDare(d)).map(d => d + ': ' + N.unsafeDare(d)).join(' | '));
};
// C61: Go dark's countdown runs on the server's clock when the phone's is a day off either way.
