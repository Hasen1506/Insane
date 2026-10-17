// C20 / P22: trimming user text without splitting a grapheme (emoji, Tamil vowel signs, Arabic marks).
// clip(s, n): at most n UTF-16 units, whole graphemes only, and at a word boundary when one is in the
// second half. The page has the same rule (src/js/00-helpers.js clip); test/pbt/text.test.js checks both.
'use strict';
const SEG = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter() : null;
function clip(s, n) {
  s = String(s ?? '').trim(); if (s.length <= n) return s;
  let o = ''; for (const c of SEG ? Array.from(SEG.segment(s), x => x.segment) : Array.from(s)) { if (o.length + c.length > n) break; o += c; }
  const w = o.lastIndexOf(' ');
  return (w > n / 2 && !/\s/.test(s[o.length]) ? o.slice(0, w) : o).trim();
}
module.exports = { clip };
