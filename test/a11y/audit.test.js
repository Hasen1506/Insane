// The audit audits itself: a page of known-bad and known-good pieces, and what test/lib/a11y.js must say about it.
'use strict';
const BR = require('../lib/browser'), A = require('../lib/a11y');

const HTML = `<!doctype html><html lang="en"><body style="margin:0;background:#fff;font:16px sans-serif">
<p id="ok1" style="color:#151D36">fine ink</p>
<p id="bad1" style="color:#999">grey on white</p>
<div style="background:linear-gradient(#C8214B,#3B1640);padding:8px"><span id="bad2" style="color:rgba(255,255,255,.85)">faded white on a red gradient</span><span id="ok2" style="color:#fff">white on it</span></div>
<div style="opacity:.5"><p id="bad3" style="color:#151D36">ink under half opacity</p></div>
<p id="okbig" style="color:#888;font-size:26px">large grey 26px</p>
<button id="bad4" style="width:30px;height:30px">x</button>
<button id="ok3" style="min-width:44px;min-height:44px">Fine</button>
<button id="bad5" style="width:48px;height:48px"><svg width="20" height="20"></svg></button>
<button id="ok4" aria-label="Close" style="width:48px;height:48px"><svg width="20" height="20"></svg></button>
<button id="bad6" style="width:48px;height:48px;background:#fff;border:0;color:#2443C4"><span aria-hidden="true" style="color:#ddd">?</span></button>
<p id="okinline">Read the <a href="#x">terms</a> first.</p>
<label style="display:flex;min-height:48px;align-items:center"><input id="okchk" type="checkbox"> I agree</label>
<button id="okdis" disabled style="width:20px;height:20px;color:#ccc">no</button>
<p id="bad7" style="font-size:10px;color:#000">tiny</p>
<p id="bad8">Ask كافيا Kavya now</p>
<p id="ok5">Ask \u2068كافيا Kavya\u2069 now</p>
<p id="ok6">Ask <bdi>كافيا Kavya</bdi> now</p>
<div class="card" id="bad9" style="background:#f9faf6;border:1px solid #f0f0f0;padding:4px">a card you can't see</div>
</body></html>`;

module.exports = async function (t) {
  const browser = await BR.launch();
  try {
    const p = await browser.newPage({ viewport: { width: 400, height: 1400 } });
    await p.setContent(HTML);
    const r = await A.audit(p, { scope: 'body' });
    const has = (list, id) => r[list].some(x => x.includes('#' + id + ' ') || x.includes('#' + id + '.') || x.includes('#' + id + '"') || x.startsWith('p#' + id) || x.includes('#' + id));
    t.ok('contrast: flags grey on white, faded white on a gradient, ink under opacity, a faint icon glyph', ['bad1', 'bad2', 'bad3'].every(id => has('contrast', id)) && r.contrast.some(x => /span "\?"/.test(x)), r.contrast.join(' | '));
    t.ok('contrast: passes ink, white on the gradient, large grey at 3:1; skips disabled controls', !['ok1', 'ok2', 'okbig', 'okdis'].some(id => has('contrast', id)), r.contrast.join(' | '));
    t.ok('targets: flags a 30 px button only (inline link, labelled checkbox and disabled button are exempt)', has('targets', 'bad4') && r.targets.length === 1, r.targets.join(' | '));
    t.ok('names: flags the unlabelled icon button only', has('names', 'bad5') && r.names.length === 1, r.names.join(' | '));
    t.ok('fonts: flags 10 px text', has('fonts', 'bad7') && r.fonts.length === 1, r.fonts.join(' | '));
    t.ok('bidi: flags the bare RTL name only (FSI…PDI and <bdi> pass)', has('bidi', 'bad8') && r.bidi.length === 1, r.bidi.join(' | '));
    t.ok('cards: flags a card with no fill contrast, shadow or visible border', has('cards', 'bad9') && r.cards.length === 1, r.cards.join(' | '));
    t.ok('total() counts every finding', A.total(r) === r.contrast.length + r.targets.length + r.names.length + r.fonts.length + r.cards.length + r.bidi.length);
  } finally { await browser.close(); }
};
