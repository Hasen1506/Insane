// WS-H properties of the contrast maths in test/lib/a11y.js (the same source runs in the page), and the
// token audit (C75): every text token on every surface token it is used on is WCAG AA, light and dark,
// read straight from src/css/tokens.css.
'use strict';
const fs = require('fs'), path = require('path');
const { prop, G } = require('./runner');
const { kit: K, colorKit } = require('../lib/a11y');

// An independent WCAG 2.x reference (sRGB → linear with the spec's 0.03928, the W3C note's figure).
const refLum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const refRatio = (a, b) => { const x = refLum(a), y = refLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

module.exports = async function (t) {
  const report = (name, r) => t.ok(name, r.ok, r.message);
  const ch = G.int(0, 255), rgb = G.map(G.tuple(ch, ch, ch), ([r, g, b]) => ({ r, g, b, a: 1 })), alpha = G.float(0, 1);
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

  report('ratio is symmetric and within [1, 21]', prop('ratio range', G.tuple(rgb, rgb), ([a, b]) => { const x = K.ratio(a, b), y = K.ratio(b, a); return Math.abs(x - y) < 1e-12 && x >= 1 - 1e-12 && x <= 21 + 1e-9; }));
  report('a colour against itself is 1:1', prop('ratio identity', rgb, c => Math.abs(K.ratio(c, c) - 1) < 1e-12));
  t.ok('black on white is exactly 21:1', Math.abs(K.ratio('#000', '#fff') - 21) < 1e-9, K.ratio('#000', '#fff'));
  report('agrees with an independent WCAG reference to 0.01', prop('ratio vs reference', G.tuple(rgb, rgb), ([a, b]) => Math.abs(K.ratio(a, b) - refRatio(a, b)) < 0.01));
  report('darkening text on white never lowers the ratio (monotone in luminance)', prop('monotone', G.tuple(rgb, G.int(1, 80)), ([c, d]) => {
    const darker = { r: Math.max(0, c.r - d), g: Math.max(0, c.g - d), b: Math.max(0, c.b - d), a: 1 };
    return K.ratio(darker, '#fff') >= K.ratio(c, '#fff') - 1e-12;
  }));
  report('parse: #rrggbb, #rgb, rgb() and rgba() give the same colour', prop('parse forms', G.tuple(rgb, alpha), ([c, a]) => {
    const h = K.parse(hex(c)), r1 = K.parse(`rgb(${c.r}, ${c.g}, ${c.b})`), r2 = K.parse(`rgba(${c.r},${c.g},${c.b},${a})`), r3 = K.parse(`rgb(${c.r} ${c.g} ${c.b} / ${a})`);
    const same = (x, y) => x && y && x.r === y.r && x.g === y.g && x.b === y.b;
    return same(h, c) && same(r1, c) && same(r2, c) && Math.abs(r2.a - a) < 1e-9 && same(r3, c) && Math.abs(r3.a - a) < 1e-9;
  }));
  t.ok('parse: short hex, transparent and junk', JSON.stringify(K.parse('#fA0')) === JSON.stringify({ r: 255, g: 170, b: 0, a: 1 }) && K.parse('transparent').a === 0 && K.parse('nope') === null && K.parse('#12') === null);
  report('blend: alpha 1 is the top colour, alpha 0 the bottom, anything between stays between', prop('blend bounds', G.tuple(rgb, rgb, alpha), ([a, b, x]) => {
    const top = K.blend({ ...a, a: 1 }, b), bot = K.blend({ ...a, a: 0 }, b), mid = K.blend({ ...a, a: x }, b);
    const between = k => mid[k] >= Math.min(a[k], b[k]) - 1e-9 && mid[k] <= Math.max(a[k], b[k]) + 1e-9;
    return ['r', 'g', 'b'].every(k => Math.abs(top[k] - a[k]) < 1e-9 && Math.abs(bot[k] - b[k]) < 1e-9 && between(k)) && mid.a === 1;
  }));
  // (true for greys; for hues, sRGB blending can step outside the two luminances, so it isn't a law there)
  const grey = G.map(ch, v => ({ r: v, g: v, b: v, a: 1 }));
  report('a translucent grey never has more contrast than the same grey opaque', prop('alpha lowers contrast', G.tuple(grey, grey, alpha), ([f, b, x]) => K.ratio({ ...f, a: x }, b) <= K.ratio(f, b) + 1e-9));
  report('the AA threshold: 3:1 for large text (≥24 px, or ≥18.66 px bold), else 4.5:1', prop('need', G.tuple(G.float(8, 40), G.pick([300, 400, 500, 600, 700, 800, 900])), ([px, w]) => K.need(px, w) === (px >= 24 || (px >= 18.66 && w >= 700) ? 3 : 4.5)));
  report('gradient stops: every colour in a gradient string is found', prop('stops', G.array(rgb, { min: 2, max: 5 }), cs => { const s = `linear-gradient(160deg, ${cs.map((c, i) => i % 2 ? hex(c) : `rgb(${c.r}, ${c.g}, ${c.b})`).join(', ')})`; const got = K.stops(s); return got.length === cs.length && got.every((g, i) => g.r === cs[i].r && g.g === cs[i].g && g.b === cs[i].b); }));
  t.ok('the page runs the same kit (colorKit source round-trips through eval)', (0, eval)('(' + colorKit.toString() + ')')().ratio('#151D36', '#ECEEE7') === K.ratio('#151D36', '#ECEEE7'));

  // C75: the token audit, light and dark, from tokens.css itself
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'css', 'tokens.css'), 'utf8');
  const block = re => { const m = re.exec(css); const o = {}; if (m) for (const d of m[1].matchAll(/--([\w-]+):([^;]+)/g)) o[d[1]] = d[2].trim(); return o; };
  const light = block(/:root\{([^}]*)\}/), dark = { ...light, ...block(/prefers-color-scheme:dark\)\{:root\{([^}]*)\}/) };
  const over = (theme, tok, base) => { const c = K.parse(theme[tok]); return c.a < 1 ? K.blend(c, K.parse(theme[base])) : c; };
  // [text, surface (soft tints are composited over the card), minimum]
  const PAIRS = [];
  for (const fg of ['ink', 'muted', 'stamp', 'ball', 'haz', 'good']) for (const bg of ['paper', 'card', 'cell']) PAIRS.push([fg, bg, 4.5]);
  for (const k of ['stamp', 'ball', 'haz', 'good']) PAIRS.push([k, k + '-soft', 4.5], ['muted', k + '-soft', 4.5], ['ink', k + '-soft', 4.5]);
  PAIRS.push(['paper', 'ink', 4.5], ['ons', 'stamp', 4.5], ['ond', 'dd1', 4.5], ['ond', 'dd2', 4.5], ['mn-ink', 'mn', 4.5], ['mn-dim', 'mn', 4.5], ['mn-hi', 'mn', 4.5], ['night-ink', 'night', 4.5], ['night-dim', 'night', 4.5]);
  PAIRS.push(['line', 'paper', 1.4], ['line', 'card', 1.4], ['muted', 'card', 3]); // borders and the input outline: non-text contrast
  for (const [name, th] of [['light', light], ['dark', dark]]) {
    const bad = [];
    for (const [f, b, min] of PAIRS) {
      if (!th[f] || !th[b]) { bad.push(`missing --${th[f] ? b : f}`); continue; }
      const bg = over(th, b, 'card'), r = K.ratio(over(th, f, 'card'), bg);
      if (r < min) bad.push(`--${f} on --${b} ${r.toFixed(2)} < ${min}`);
    }
    t.ok(`C75 token audit, ${name}: ${PAIRS.length} text/surface pairs meet AA`, !bad.length, bad.join(' | '));
    const card = K.ratio(K.parse(th.card), K.parse(th.paper));
    t.ok(`C72 ${name}: a card stands off the paper (fill ≥ 1.25:1, or a shadow)`, card >= 1.25 || (th.shadow && th.shadow !== 'none'), card.toFixed(2));
  }
  // C75 lint: no raw colour outside tokens.css (PLAN-V09 §3: others use tokens only)
  const dir = path.join(__dirname, '..', '..', 'src', 'css'), raw = [];
  for (const f of fs.readdirSync(dir)) if (f !== 'tokens.css') { const s = fs.readFileSync(path.join(dir, f), 'utf8'); for (const m of s.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\((?!0,0,0|0, 0, 0|255,255,255)[^)]*\)/g)) raw.push(`${f}: ${m[0]}`); }
  t.ok('C75 no raw colours in css/ outside tokens.css (black/white shadows and scrims excepted)', !raw.length, raw.join(' | '));
};
