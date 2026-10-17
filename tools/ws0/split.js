// WS-0, run once: split v0.8's app/index.html into src/ with no behaviour change.
// Kept in the repo so the split can be audited and re-run against fac3720:
//   git show fac3720:app/index.html > /tmp/v08.html
//   npm i --no-save acorn && node tools/ws0/split.js /tmp/v08.html
// acorn is only needed for this one-off (to cut the act() and sheetBody() switches into registries
// exactly and to prove the module order keeps every load-time reference valid). The build needs nothing.
'use strict';
const fs = require('fs'), path = require('path');
const acorn = require(process.env.ACORN || 'acorn');
const REPO = path.resolve(__dirname, '..', '..');
const SRC = path.join(REPO, 'src');
const html = fs.readFileSync(process.argv[2] || path.join(REPO, 'app', 'index.html'), 'utf8');
const L = html.split('\n'); // L[i] is line i+1
const lines = (a, b) => L.slice(a - 1, b).join('\n') + '\n';
const must = (c, m) => { if (!c) { console.error('split: ' + m); process.exit(1); } };

// ---- the frame: head, <style>, body markup, <script>
must(L[5] === '<style>' && L[273] === '</style>' && L[296] === '<script>' && L[1974] === '</script>' && L[1975] === '', 'v0.8 layout not where expected (lines 6, 274, 297, 1975)');
const out = {};
out['head.html'] = lines(1, 5);
out['body.html'] = lines(275, 296);
// CSS: contiguous slices in the original order, so the cascade is byte-identical.
out['css/tokens.css'] = lines(7, 26);
out['css/base.css'] = lines(27, 57);
out['css/components.css'] = lines(58, 181);
out['css/map.css'] = lines(182, 190);
out['css/screens.css'] = lines(191, 273);

// ---- JS: PLAN-V09 §2 layout. [file, [from,to], ...] in html line numbers.
const JS = [
  ['00-helpers.js', [298, 321]],
  ['10-places.js', [322, 389]],
  ['20-map.js', [390, 492]],
  ['25-picker.js', [846, 895]],
  ['30-lanes.js', [493, 528]],
  ['35-decode.js', [529, 549]],
  ['36-drops.js', [550, 559]],
  ['40-store-local.js', [560, 588]],
  ['41-store-remote.js', [589, 617]],
  ['50-state.js', [618, 691]],
  ['55-writes.js', [692, 750]],
  ['60-boot.js', [751, 781]],
  ['65-game.js', [1260, 1277], [1288, 1309]],
  ['70-shell.js', [782, 845]],
  ['71-onboarding.js', [896, 979]],
  ['72-home.js', [980, 1037], [1310, 1356]],
  ['73-circle.js', [1038, 1120], [1357, 1412]],
  ['74-city.js', [1121, 1203], [1413, 1424]],
  ['75-ledger.js', [1278, 1287], [1425, 1490]],
  ['76-you.js', [1204, 1259]],
  ['77-plus.js', [1491, 1502]],
  ['78-sheets/', [1553, 1684]],   // layer() + sheetBody() switch -> registry, + sealOpts
  ['79-activity.js', [1503, 1552], [1685, 1688]], // + toast
  ['80-input.js', [1689, 1724]],
  ['90-actions/', [1725, 1973]],  // act() switch -> registry
  ['99-start.js', [1974, 1974]],
];
// every script line used exactly once
const seen = new Map();
for (const [f, ...rs] of JS) for (const [a, b] of rs) for (let i = a; i <= b; i++) { must(!seen.has(i), `line ${i} in ${f} and ${seen.get(i)}`); seen.set(i, f); }
for (let i = 298; i <= 1974; i++) must(seen.has(i), 'line not assigned: ' + i);

const js = L.slice(297, 1974).join('\n') + '\n';           // script body, html lines 298..1974
const lineStart = []; { let p = 0; for (let i = 298; i <= 1975; i++) { lineStart[i] = p; p += L[i - 1].length + 1; } }
const comments = [];
const ast = acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'script', onComment: comments });
const fnDecl = n => ast.body.find(x => x.type === 'FunctionDeclaration' && x.id.name === n);

// ---- turn a switch into registrations. Each case body is copied verbatim.
function terminates(st) { if (!st) return false; switch (st.type) { case 'ReturnStatement': case 'ThrowStatement': return true; case 'BlockStatement': return st.body.length > 0 && terminates(st.body.at(-1)); case 'IfStatement': return terminates(st.consequent) && terminates(st.alternate); default: return false; } }
function cases(fn, { reg, sig, pre }) {
  const body = fn.body.body; const sw = body.find(n => n.type === 'SwitchStatement');
  const groups = []; let labels = [];
  const seenLabels = new Set();
  for (const c of sw.cases) {
    must(c.test && c.test.type === 'Literal' && typeof c.test.value === 'string', `${fn.id.name}: non-string case`);
    must(!seenLabels.has(c.test.value), `${fn.id.name}: duplicate case ${c.test.value}`); seenLabels.add(c.test.value);
    labels.push(c.test.value);
    if (!c.consequent.length) continue;
    const last = c.consequent.at(-1);
    must(terminates(last), `${fn.id.name}: case ${labels} can fall through`);
    for (const s of c.consequent) must(s.type !== 'VariableDeclaration' && s.type !== 'FunctionDeclaration', `${fn.id.name}: switch-level declaration in ${labels}`);
    // the section comment (/* onboarding */) this case sits under
    const sec = comments.filter(k => k.start > sw.discriminant.end && k.end < c.start && !groups.some(g => g.end > k.start)).at(-1);
    groups.push({ labels, start: c.consequent[0].start, end: last.end, caseStart: c.start, text: js.slice(c.consequent[0].start, last.end) });
    labels = [];
  }
  must(!labels.length, 'trailing empty case');
  // every comment inside the switch is either inside a body or a section header between cases
  const sections = [];
  for (const k of comments) if (k.start > sw.start && k.end < sw.end) {
    const inBody = groups.some(g => k.start >= g.start && k.end <= g.end);
    if (!inBody) { must(k.type === 'Block', 'stray comment in switch: ' + k.value); sections.push(k); }
  }
  for (const g of groups) g.section = (sections.filter(k => k.end < g.caseStart).at(-1) || { value: '' }).value.trim();
  return { groups, sw, before: body.slice(0, body.indexOf(sw)), after: body.slice(body.indexOf(sw) + 1) };
}
const reg = (R, g, sig, pre) => `${g.labels.map(l => `${R}[${JSON.stringify(l)}]`).join('=')}=${sig}=>{${pre}\n  ${g.text}\n};\n`;

// act()
const actFn = fnDecl('act');
const A = cases(actFn, {});
must(A.before.length === 1 && js.slice(A.before[0].start, A.before[0].end) === 'const db=S.db,uid=S.uid,me=S.me;' && A.after.length === 0, 'act() preamble changed');
const ACT_FILES = { 'onboarding': 'onboarding', 'nav': 'nav', 'circle': 'circle', 'journeys': 'journeys', 'decode': 'decode', 'drops': 'drops', 'feed': 'city', 'calls': 'city', 'meeting in person': 'meet', 'midnight and sealed': 'midnight', 'go dark': 'dark', 'the + sheet': 'plus', 'pots': 'pots', 'plans': 'plans', 'favors': 'favors', 'dares and clips': 'dares', 'Midnight': 'midnight', 'the Mole': 'mole', 'Missions': 'city', 'trails': 'city', 'feed reactions': 'city', 'profile and data': 'you' };
const actOut = {};
for (const g of A.groups) {
  const f = ACT_FILES[g.section]; must(f, 'no file for act section ' + g.section);
  (actOut[f] = actOut[f] || []).push((actOut[f]._last !== g.section ? `/* ${g.section} */\n` : '') + reg('ACT', g, 'async(d,el,a)', 'const db=S.db,uid=S.uid,me=S.me;'));
  actOut[f]._last = g.section;
}
out['js/90-actions/00-registry.js'] =
  `/* ---------- actions: every data-act / data-form goes through act(), handlers registered per module ---------- */
// v0.8 had one 250-line switch here. WS-0 turned each case into ACT['name']=async(d,el,a)=>{…}, body unchanged:
// d is the element's dataset, el the element, a the action name; db, uid and me are read when the handler runs.
const ACT=Object.create(null);
function act(a,d,el){const h=ACT[a];return h?h(d,el,a):Promise.resolve()}
`;
for (const [f, parts] of Object.entries(actOut)) out[`js/90-actions/${f}.js`] = parts.join('');

// sheetBody()
const shFn = fnDecl('sheetBody');
const SH = cases(shFn, {});
const closeDecl = js.slice(SH.before[0].start, SH.before[0].end);
must(SH.before.length === 1 && /^const close=`[^$]*`;$/.test(closeDecl) && SH.after.length === 1 && js.slice(SH.after[0].start, SH.after[0].end) === 'return close;', 'sheetBody() frame changed');
const SH_FILES = { 'circle-start': 'invite', 'invite': 'invite', 'meet': 'invite', 'make': 'make', 'add-j': 'journeys', 'j-menu': 'journeys', 'proof': 'dares', 'dare': 'dares', 'clip': 'dares', 'fvdone': 'favors', 'pay-note': 'pots', 'mission': 'city', 'propose': 'city', 'trail-new': 'city', 'trail': 'city', 'thread-new': 'thread', 'decode': 'decode', 'host': 'drops', 'drop': 'drops', 'activity': 'you', 'profile': 'you', 'midnight': 'midnight', 'seal': 'midnight' };
const shOut = {};
for (const g of SH.groups) { const f = SH_FILES[g.labels[0]]; must(f && g.labels.every(l => SH_FILES[l] === f), 'no sheet file for ' + g.labels); (shOut[f] = shOut[f] || []).push(reg('SHEETS', g, '(sh,close)', '')); }
// 78-sheets/00-layer.js: layer() and the sheetBody() frame; then one file per family; sealOpts with midnight.
const sheetStart = lineStart[1553], shStart = shFn.start, shEnd = shFn.end;
const layerText = js.slice(sheetStart, shStart);
const tail = js.slice(shEnd, lineStart[1685]); // "\nfunction sealOpts(){...}\n"
must(/^\nfunction sealOpts\(\)/.test(tail), 'sealOpts not after sheetBody');
out['js/78-sheets/00-layer.js'] = layerText +
  `// v0.8's sheetBody() switch, as a registry: SHEETS['name']=(sh,close)=>html, bodies unchanged.
const SHEETS=Object.create(null);
function sheetBody(sh){
  ${closeDecl}
  const f=SHEETS[sh.t];if(f)return f(sh,close);
  return close;
}
`;
for (const [f, parts] of Object.entries(shOut)) out[`js/78-sheets/${f}.js`] = parts.join('') + (f === 'midnight' ? tail.slice(1) : '');

// ---- plain slices
const slice = rs => rs.map(([a, b]) => js.slice(lineStart[a], lineStart[b + 1])).join('');
for (const [f, ...rs] of JS) if (!f.endsWith('/')) out['js/' + f] = slice(rs);
must(js.slice(lineStart[1725], lineStart[1974]) === js.slice(actFn.start, actFn.end) + '\n', 'act() is not exactly lines 1725-1973');

// ---- prove the new order keeps every load-time reference to a const/let/class after its declaration
const ORDER = Object.keys(out).filter(k => k.startsWith('js/')).sort();
const newJs = ORDER.map(k => out[k]).join('');
function topDecls(prog) { const lex = new Map(), fns = new Map(); prog.body.forEach((n, i) => { if (n.type === 'VariableDeclaration' && n.kind !== 'var') for (const d of n.declarations) collectIds(d.id).forEach(x => lex.set(x, i)); if (n.type === 'ClassDeclaration') lex.set(n.id.name, i); if (n.type === 'FunctionDeclaration') fns.set(n.id.name, n); }); return { lex, fns }; }
function collectIds(p) { if (!p) return []; if (p.type === 'Identifier') return [p.name]; if (p.type === 'ObjectPattern') return p.properties.flatMap(q => collectIds(q.value || q.argument)); if (p.type === 'ArrayPattern') return p.elements.flatMap(collectIds); if (p.type === 'AssignmentPattern') return collectIds(p.left); if (p.type === 'RestElement') return collectIds(p.argument); return []; }
// identifiers evaluated right away (not inside a function body), plus the bodies of top-level functions those call
function eager(node, fns, acc = new Set(), seenFns = new Set()) {
  (function w(n, parent, key) {
    if (!n || typeof n.type !== 'string') return;
    if (/Function/.test(n.type) && n !== node) return; // deferred
    if (n.type === 'ClassBody') { for (const m of n.body) { if (m.computed) w(m.key); if (m.static && m.value && m.type === 'PropertyDefinition') w(m.value); if (m.type === 'StaticBlock') m.body.forEach(s => w(s)); } return; }
    if (n.type === 'Identifier') { if (parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) || (parent.type === 'Property' && key === 'key' && !parent.computed))) return; acc.add(n.name); }
    if (n.type === 'CallExpression' && n.callee.type === 'Identifier' && fns.has(n.callee.name) && !seenFns.has(n.callee.name)) { seenFns.add(n.callee.name); deep(fns.get(n.callee.name).body); }
    for (const k in n) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => w(c, n, k)); else if (v && typeof v.type === 'string') w(v, n, k); }
  })(node);
  function deep(b) { // a called function: everything it touches, including nested calls
    (function w(n, parent, key) { if (!n || typeof n.type !== 'string') return; if (n.type === 'Identifier') { if (parent && ((parent.type === 'MemberExpression' && key === 'property' && !parent.computed) || (parent.type === 'Property' && key === 'key' && !parent.computed))) return; acc.add(n.name); if (fns.has(n.name) && !seenFns.has(n.name)) { seenFns.add(n.name); w(fns.get(n.name).body); } } for (const k in n) { if (k === 'type' || k === 'start' || k === 'end') continue; const v = n[k]; if (Array.isArray(v)) v.forEach(c => w(c, n, k)); else if (v && typeof v.type === 'string') w(v, n, k); } })(b);
  }
  return acc;
}
function tdz(src, label) {
  const p = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' }); const { lex, fns } = topDecls(p); const bad = [];
  p.body.forEach((n, i) => { if (n.type === 'FunctionDeclaration') return; for (const id of eager(n, fns)) if (lex.has(id) && lex.get(id) > i) bad.push(`${id} used by top-level statement ${i} (${src.slice(n.start, n.start + 60).replace(/\n/g, ' ')}) before its declaration`); });
  return { bad, effects: p.body.filter(n => n.type === 'ExpressionStatement' && !n.directive && !/^(ACT|SHEETS)\[/.test(src.slice(n.start, n.start + 8))).map(n => src.slice(n.start, n.end).slice(0, 80)) };
}
const o = tdz(js, 'v0.8'), nw = tdz(newJs, 'v0.9');
must(o.bad.length === 0, 'v0.8 itself has early references?\n' + o.bad.join('\n'));
must(nw.bad.length === 0, 'new order breaks load-time references:\n' + nw.bad.join('\n'));
must(JSON.stringify(o.effects) === JSON.stringify(nw.effects), 'top-level side effects changed order:\n' + o.effects.join('\n') + '\n---\n' + nw.effects.join('\n'));
// same top-level names, nothing lost or added except the two registries
const names = src => { const p = acorn.parse(src, { ecmaVersion: 'latest' }); return p.body.flatMap(n => n.type === 'FunctionDeclaration' || n.type === 'ClassDeclaration' ? [n.id.name] : n.type === 'VariableDeclaration' ? n.declarations.flatMap(d => collectIds(d.id)) : []).sort(); };
const added = names(newJs).filter(x => !names(js).includes(x)), lost = names(js).filter(x => !names(newJs).includes(x));
must(JSON.stringify(added) === '["ACT","SHEETS"]' && lost.length === 0, `top-level names differ: +${added} -${lost}`);

// ---- write
fs.rmSync(SRC, { recursive: true, force: true });
for (const [k, v] of Object.entries(out)) { const f = path.join(SRC, k); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, v); }
console.log(`split: ${Object.keys(out).length} files, ${A.groups.length} action handlers (${A.groups.reduce((n, g) => n + g.labels.length, 0)} names), ${SH.groups.length} sheets; load order and side effects verified`);
console.log('side effects in order: ' + nw.effects.length);
