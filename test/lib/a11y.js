// WS-H accessibility audit (C75, C76, C77, C79, C70, C72): one checker for every screen, computed from the
// live DOM in the page, no dependencies. The colour maths is plain functions (colorKit) so the PBT can test
// it in Node and the page runs the very same source (injected with Function.prototype.toString).
//
//   const A = require('../lib/a11y');
//   const r = await A.audit(page)   -> { contrast:[…], targets:[…], names:[…], fonts:[…], cards:[…], hscroll }
//   A.kit.ratio('#000', '#fff')     -> 21
// Rules (WCAG 2.2 AA unless noted):
//   contrast  text vs what is actually behind it (background colours composited up the tree, gradients
//             checked at every stop, element and ancestor opacity applied): 4.5:1, 3:1 for large text
//             (≥24 px, or ≥18.66 px bold). Disabled controls are exempt (1.4.3).
//   targets   every control (button, link, input, select, textarea, summary, [role=button], [data-act])
//             is at least 44×44 CSS px (C76; stricter than 2.5.8's 24 px). Exempt: inline links inside a
//             sentence (2.5.8's inline exception), disabled controls, a checkbox/radio whose label is the
//             44 px target, and controls nested in another control.
//   names     every control has an accessible name (aria-label, aria-labelledby, title, alt, a <label>,
//             or text) (C77, 4.1.2).
//   fonts     no visible text under 12 px (C70).
//   bidi      text with right-to-left letters is isolated from its sentence (C21)
//   anims     with reduced motion asked for, nothing is animating (C80)
//   cards     a .card stands off what is behind it: (fill ≥ 1.25:1 or a shadow) and a border ≥ 1.4:1 (C72).
'use strict';

function colorKit() {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // '#rgb' '#rrggbb' '#rrggbbaa' 'rgb(r, g, b)' 'rgba(r, g, b, a)' 'rgb(r g b / a)' -> {r,g,b,a} or null
  function parse(s) {
    if (s && typeof s === 'object') return s;
    s = String(s || '').trim();
    let m = /^#([0-9a-f]{3,8})$/i.exec(s);
    if (m) {
      let h = m[1]; if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
      if (h.length !== 6 && h.length !== 8) return null;
      const n = i => parseInt(h.slice(i, i + 2), 16);
      return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
    }
    m = /^rgba?\(([^)]+)\)$/i.exec(s); if (!m) return s === 'transparent' ? { r: 0, g: 0, b: 0, a: 0 } : null;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map((x, i) => /%$/.test(x) ? parseFloat(x) / 100 * (i < 3 ? 255 : 1) : +x);
    if (p.length < 3 || p.slice(0, 3).some(x => !isFinite(x))) return null;
    return { r: clamp(p[0], 0, 255), g: clamp(p[1], 0, 255), b: clamp(p[2], 0, 255), a: p.length > 3 && isFinite(p[3]) ? clamp(p[3], 0, 1) : 1 };
  }
  // relative luminance (WCAG 2.x)
  const lum = c => { c = parse(c); const f = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  // `top` painted over an opaque `bot`
  const blend = (top, bot) => { top = parse(top); bot = parse(bot); const a = top.a; return { r: top.r * a + bot.r * (1 - a), g: top.g * a + bot.g * (1 - a), b: top.b * a + bot.b * (1 - a), a: 1 }; };
  // contrast ratio of two colours; a translucent foreground is composited over the background first
  const ratio = (fg, bg) => { bg = parse(bg); if (bg.a < 1) bg = blend(bg, { r: 255, g: 255, b: 255, a: 1 }); fg = parse(fg); if (fg.a < 1) fg = blend(fg, bg); const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const large = (px, weight) => px >= 24 || (px >= 18.66 && weight >= 700);
  const need = (px, weight) => large(px, weight) ? 3 : 4.5;
  // every colour stop in a CSS gradient string
  const stops = s => (String(s || '').match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}\b/gi) || []).map(parse).filter(Boolean);
  return { parse, lum, blend, ratio, large, need, stops };
}

// Runs in the page. `kit` is colorKit's source; opts.scope limits the audit (default: the open sheet, else body).
function pageAudit(kitSrc, opts) {
  const K = (0, eval)('(' + kitSrc + ')')();
  const WHITE = { r: 255, g: 255, b: 255, a: 1 };
  const cs = el => getComputedStyle(el);
  const visible = el => { if (!el.getClientRects().length) return false; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const s = cs(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } return true; };
  const hidden = el => !!el.closest('[aria-hidden="true"],[inert],.rail,svg,.sr');
  const scope = opts.scope ? document.querySelector(opts.scope) : (document.querySelector('.sheet') || document.body);
  const desc = el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).join('.') : ''}${el.dataset && el.dataset.act ? '[' + el.dataset.act + (el.dataset.v ? '=' + el.dataset.v : '') + ']' : ''}`;
  const txt = el => (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
  // the backgrounds behind el, nearest first, down to the first opaque one; each is a list of candidate colours
  function behind(el) {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const s = cs(e), bg = K.parse(s.backgroundColor), img = s.backgroundImage;
      const g = img && img !== 'none' && /gradient/.test(img) ? K.stops(img) : [];
      if (g.length) { layers.push(g.map(c => bg && bg.a ? K.blend(c, bg.a >= 1 ? bg : WHITE) : c)); if (g.every(c => c.a >= 1)) break; continue; }
      if (bg && bg.a > 0) { layers.push([bg]); if (bg.a >= 1) break; }
    }
    let base = [K.parse(cs(document.documentElement).backgroundColor) || WHITE].map(c => c.a ? K.blend(c, WHITE) : WHITE);
    for (const L of layers.reverse()) { const nx = []; for (const c of L) for (const b of base) nx.push(K.blend(c, b)); base = nx; }
    return base;
  }
  const opacity = el => { let o = 1; for (let e = el; e; e = e.parentElement) o *= +cs(e).opacity; return o; };
  const out = { contrast: [], targets: [], names: [], fonts: [], cards: [], bidi: [], anims: 0, counts: { text: 0, targets: 0, cards: 0 }, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
  if (!scope) return out;

  // text contrast and size; a glyph hidden from readers inside a control (an icon like "?" or "+") is
  // non-text contrast (1.4.11): 3:1
  const CTL = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[data-act]';
  for (const el of scope.querySelectorAll('*')) {
    const icon = hidden(el) && !el.closest('[inert],.rail,svg,.sr') && !!el.closest(CTL) && !!el.closest('[aria-hidden="true"]');
    if (hidden(el) && !icon) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own || !visible(el)) continue;
    if (el.closest('button:disabled,[disabled],[aria-disabled="true"]')) continue;
    const s = cs(el); const fg0 = K.parse(s.color); if (!fg0) continue;
    out.counts.text++;
    const px = parseFloat(s.fontSize), w = +s.fontWeight || 400, need = icon ? 3 : K.need(px, w), op = opacity(el);
    let worst = 99;
    for (const bg of behind(el)) { let fg = K.blend(fg0, bg); if (op < 1) fg = K.blend({ ...fg, a: op }, bg); worst = Math.min(worst, K.ratio(fg, bg)); }
    if (worst < need) out.contrast.push(`${desc(el)} "${txt(el)}" ${worst.toFixed(2)}<${need}`);
    if (px < 12 && !icon) out.fonts.push(`${desc(el)} "${txt(el)}" ${px}px`);
  }

  // targets and names
  const labelOf = el => (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest('label');
  for (const el of scope.querySelectorAll(CTL)) {
    if (hidden(el) || !visible(el)) continue;
    if (el.matches('[data-act="sheet-bg"]')) continue; // the sheet's backdrop is a big target, not a control
    if (el.parentElement && el.parentElement.closest(CTL) && !el.matches('input,select,textarea')) continue; // nested: the outer control is the target
    const disabled = el.matches(':disabled,[aria-disabled="true"]');
    out.counts.targets++;
    // name
    const lab = labelOf(el);
    const name = (el.getAttribute('aria-label') || '').trim() || (el.getAttribute('aria-labelledby') || '').split(/\s+/).map(id => document.getElementById(id)).filter(Boolean).map(x => x.textContent).join(' ').trim()
      || (el.getAttribute('title') || '').trim() || (lab && lab.textContent.trim()) || (el.matches('input,textarea') && (el.placeholder || '').trim()) || (el.matches('input[type=submit],input[type=button]') && el.value) || (el.querySelector('img[alt]') && el.querySelector('img[alt]').alt.trim()) || (el.innerText || el.textContent || '').trim();
    if (!name) out.names.push(desc(el));
    if (disabled) continue;
    // size
    let r = el.getBoundingClientRect();
    if (el.matches('input[type=checkbox],input[type=radio]') && lab) r = lab.getBoundingClientRect();
    const st = cs(el);
    if (/^inline($|-block)/.test(st.display) && el.matches('a,button.link')) { const p = el.parentElement; const sib = p && [...p.childNodes].some(n => n !== el && n.nodeType === 3 && n.textContent.trim()); if (sib) continue; } // 2.5.8 inline exception
    if (r.width < 44 - 0.5 || r.height < 44 - 0.5) out.targets.push(`${desc(el)} "${txt(el)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  }

  // cards stand off the page (C72)
  for (const el of scope.querySelectorAll('.card')) {
    if (hidden(el) || !visible(el)) continue;
    const s = cs(el), fill = K.parse(s.backgroundColor); if (!fill || !fill.a || s.borderStyle === 'dashed') continue;
    out.counts.cards++;
    const under = behind(el.parentElement)[0], f = K.blend(fill, under);
    const r1 = K.ratio(f, under), bc = K.parse(s.borderTopColor), bw = parseFloat(s.borderTopWidth) || 0;
    const r2 = bw && bc ? K.ratio(K.blend(bc, under), under) : 1, shadow = s.boxShadow && s.boxShadow !== 'none';
    if (!(r1 >= 1.25 || shadow) || r2 < 1.4) out.cards.push(`${desc(el)} "${txt(el)}" fill ${r1.toFixed(2)} border ${r2.toFixed(2)}`);
  }
  // C21: right-to-left text is isolated from what is around it (FSI…PDI, <bdi>, dir=…, or unicode-bidi isolate/plaintext)
  const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  const tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  for (let n; (n = tw.nextNode());) {
    const v = n.textContent; if (!RTL.test(v)) continue; const el = n.parentElement; if (!el || hidden(el) || !visible(el)) continue;
    const i = v.search(RTL), iso = v.lastIndexOf('\u2068', i) > v.lastIndexOf('\u2069', i);
    let ok = iso || !!el.closest('bdi,[dir],input,textarea');
    for (let e = el; !ok && e && e !== scope.parentElement; e = e.parentElement) ok = /isolate|plaintext/.test(cs(e).unicodeBidi);
    if (!ok) out.bidi.push(`${desc(el)} "${v.trim().slice(0, 28)}"`);
  }
  out.anims = document.getAnimations().filter(a => a.playState === 'running').length;
  return out;
}

const kit = colorKit();
const audit = (page, opts = {}) => page.evaluate(([k, src, o]) => (0, eval)('(' + src + ')')(k, o), [colorKit.toString(), pageAudit.toString(), opts]);
const total = r => r.contrast.length + r.targets.length + r.names.length + r.fonts.length + r.cards.length + r.bidi.length + (r.anims ? 1 : 0) + (r.hscroll ? 1 : 0);
module.exports = { colorKit, kit, pageAudit, audit, total };
