// Golden helpers (PLAN-V09 §5.d): a DOM golden (normalised text-and-role tree, diff-friendly) and a
// pixel golden (JPEG 400 px wide, quality 70, compared in Chromium's own canvas, so no image deps).
//
//   const snap = await domSnapshot(page)             -> string
//   matchDom('home-solo', snap)                      -> { ok, created, diff }
//   const img = await pixelShot(page)                -> { jpeg: Buffer, w, h }   (normalised: 400 px, q70)
//   await pixelDiff(page, imgA, imgB)                -> fraction of differing pixels (0..1)
//   await matchPixels(page, 'home-solo', img)        -> { ok, created, ratio }
// Goldens live in test/golden/dom/*.txt and test/golden/img/*.jpg. GOLDEN_UPDATE=1 rewrites them.
// A missing golden is written and reported as created (ok), unless GOLDEN_STRICT=1, where it fails.
// Determinism is the caller's job: fixed clock, seeded randomness (seedRandom), animations off (freeze).
'use strict';
const fs = require('fs'), path = require('path');
const DIR = process.env.GOLDEN_DIR || path.join(__dirname, '..', 'golden');

// Seeded Math.random and crypto.getRandomValues for every page in a context (before any app code runs).
const seedRandom = (ctxOrPage, seed = 1) => ctxOrPage.addInitScript(s => {
  let a = s >>> 0; const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  Math.random = next;
  const gv = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = arr => { if (!arr || !arr.BYTES_PER_ELEMENT) return gv(arr); const max = 2 ** (8 * arr.BYTES_PER_ELEMENT); for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(next() * max); return arr; };
  if (crypto.randomUUID) crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(next() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });
}, seed);
// No animations, transitions or blinking caret, so a shot taken twice is the same picture.
const freeze = page => page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}' });

// The DOM as a reader meets it: one line per element that carries meaning, indented by depth.
// Line: tag[#id][.classes] [role=…] [act=…] [name=…] "own text". Inputs show their value.
async function domSnapshot(page, sel = '#app', { mask = [] } = {}) {
  const raw = await page.evaluate(sel => {
    const root = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!root) return '(missing ' + sel + ')';
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);
    const IMPLICIT = { BUTTON: 'button', A: 'link', NAV: 'navigation', MAIN: 'main', HEADER: 'banner', H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', INPUT: 'textbox', TEXTAREA: 'textbox', SELECT: 'combobox', UL: 'list', OL: 'list', LI: 'listitem', TABLE: 'table', IMG: 'img', LABEL: 'label', FORM: 'form', ASIDE: 'complementary' };
    const out = [];
    const own = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    (function walk(el, d) {
      if (SKIP.has(el.tagName)) return;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (el.tagName === 'svg' || el.tagName === 'CANVAS') { out.push('  '.repeat(d) + el.tagName.toLowerCase() + (el.getAttribute('aria-label') ? ` name="${el.getAttribute('aria-label')}"` : '')); return; }
      let role = el.getAttribute('role') || IMPLICIT[el.tagName] || '';
      if (el.tagName === 'INPUT' && /checkbox|radio/.test(el.type)) role = el.type;
      const parts = [el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].map(c => '.' + c).join('')];
      if (role) parts.push('role=' + role);
      for (const a of ['data-act', 'data-v', 'data-form', 'aria-label', 'aria-current', 'aria-pressed', 'disabled', 'href', 'placeholder']) if (el.hasAttribute(a)) parts.push(a.replace(/^data-/, '') + '=' + JSON.stringify(el.getAttribute(a)));
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) parts.push(/checkbox|radio/.test(el.type) ? 'checked=' + el.checked : 'value=' + JSON.stringify(el.value));
      const t = own(el); if (t) parts.push(JSON.stringify(t));
      const meaningful = role || t || el.id || el.hasAttribute('data-act') || el.children.length === 0;
      if (meaningful) out.push('  '.repeat(d) + parts.join(' '));
      for (const c of el.children) walk(c, meaningful ? d + 1 : d);
    })(root, 0);
    return out.join('\n');
  }, sel);
  return mask.reduce((s, [re, by]) => s.replace(re, by), raw) + '\n';
}

function lineDiff(a, b, ctx = 2) {
  const A = a.split('\n'), B = b.split('\n'); let i = 0; while (i < A.length && A[i] === B[i]) i++;
  let j = 0; while (j < A.length - i && j < B.length - i && A[A.length - 1 - j] === B[B.length - 1 - j]) j++;
  return [`@@ line ${i + 1}`, ...A.slice(Math.max(0, i - ctx), i).map(l => '  ' + l), ...A.slice(i, A.length - j).map(l => '- ' + l), ...B.slice(i, B.length - j).map(l => '+ ' + l)].slice(0, 40).join('\n');
}
function matchDom(name, snap) {
  const f = path.join(DIR, 'dom', name + '.txt');
  if (process.env.GOLDEN_UPDATE === '1' || !fs.existsSync(f)) {
    if (!fs.existsSync(f) && process.env.GOLDEN_STRICT === '1') return { ok: false, created: false, diff: 'missing golden ' + f };
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, snap); return { ok: true, created: true };
  }
  const want = fs.readFileSync(f, 'utf8');
  return want === snap ? { ok: true } : { ok: false, diff: lineDiff(want, snap) };
}

// Screenshot -> 400 px wide JPEG q70, done by Chromium's canvas so the encoder is the same every time.
async function normalise(page, png, width = 400, quality = 0.7) {
  const b64 = await page.evaluate(async ([src, w, q]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = w; c.height = Math.round(img.height * w / img.width);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q).split(',')[1];
  }, [png.toString('base64'), width, quality]);
  return Buffer.from(b64, 'base64');
}
async function pixelShot(page, opts = {}) {
  const png = await page.screenshot({ type: 'png', fullPage: !!opts.fullPage, animations: 'disabled', caret: 'hide' });
  return { jpeg: await normalise(opts.helper || page, png, opts.width || 400) };
}
// Fraction of pixels whose largest channel difference exceeds `threshold` (0–255).
async function pixelDiff(page, a, b, { threshold = 32 } = {}) {
  return page.evaluate(async ([x, y, th]) => {
    const load = async s => { const i = new Image(); i.src = 'data:image/jpeg;base64,' + s; await i.decode(); return i; };
    const [ia, ib] = await Promise.all([load(x), load(y)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return 1;
    const px = i => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data; };
    const da = px(ia), db = px(ib); let bad = 0;
    for (let k = 0; k < da.length; k += 4) if (Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2])) > th) bad++;
    return bad / (da.length / 4);
  }, [a.jpeg.toString('base64'), b.jpeg.toString('base64'), threshold]);
}
async function matchPixels(page, name, shot, { tolerance = 0.001 } = {}) {
  const f = path.join(DIR, 'img', name + '.jpg');
  if (process.env.GOLDEN_UPDATE === '1' || !fs.existsSync(f)) {
    if (!fs.existsSync(f) && process.env.GOLDEN_STRICT === '1') return { ok: false, created: false, ratio: 1 };
    fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, shot.jpeg); return { ok: true, created: true, ratio: 0 };
  }
  const ratio = await pixelDiff(page, { jpeg: fs.readFileSync(f) }, shot);
  return { ok: ratio <= tolerance, ratio };
}

module.exports = { DIR, seedRandom, freeze, domSnapshot, matchDom, lineDiff, normalise, pixelShot, pixelDiff, matchPixels };
