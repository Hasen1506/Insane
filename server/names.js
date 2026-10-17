// The Midnight name screen and the dare keyword screen (C37, C88). Pure functions, no deps.
// src/js/98-safety.js carries the same code for instant feedback in the page; test/pbt/safety-names
// checks the two agree on random input. The server's copy is the one that counts.
'use strict';

// <names> (kept identical to src/js/98-safety.js by test/unit/safety.test.js)
// Look-alike letters from other scripts that people use to dodge a filter (Cyrillic/Greek → Latin).
const CONF = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'м': 'm', 'т': 't', 'н': 'h', 'в': 'b', 'ν': 'v', 'ο': 'o', 'α': 'a', 'ρ': 'p', 'τ': 't', 'ι': 'i', 'κ': 'k', 'ε': 'e', 'υ': 'u', 'ı': 'i', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'đ': 'd', 'ł': 'l', 'ħ': 'h' };
// Case-fold, take accents and combining marks off, drop invisible format characters (zero-width
// space/joiners, bidi controls, soft hyphen) and fold compatibility forms (full-width, ligatures).
function fold(s) {
  let t = String(s == null ? '' : s).normalize('NFKD').toLowerCase().normalize('NFKD').replace(/[\p{M}\p{Cf}]/gu, '');
  t = t.replace(/[\u0430-\u045f\u0370-\u03ffıßæœøđłħ]/g, c => CONF[c] || c);
  return t;
}
// Scripts written without spaces between words: a name inside a longer run still counts.
const CONTINUA = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}\p{Script=Arabic}\p{Script=Hebrew}]/u;
// Every piece of a name or handle with 2 or more letters: "كافيا Kavya" -> كافيا, kavya; "RAVI42" -> ravi, ravi42.
function nameTokens(s) {
  const f = fold(s), out = new Set();
  for (const m of f.matchAll(/\p{L}+/gu)) if ([...m[0]].length >= 2) out.add(m[0]);
  for (const m of f.matchAll(/[\p{L}\p{N}]+/gu)) if ([...m[0]].length >= 2 && /\p{L}/u.test(m[0])) out.add(m[0]);
  return out;
}
// A handle is matched whole: "RAVI42" -> ravi42, ravi; "LOW TIDE" -> the phrase "low tide" (its words
// alone, "low" and "tide", are everyday words, so they are not blocked on their own).
function handleTerms(h) {
  const words = [...fold(h).matchAll(/[\p{L}\p{N}]+/gu)].map(m => m[0]).filter(w => /\p{L}/u.test(w));
  if (words.length <= 1) return { tokens: nameTokens(h), phrase: null };
  return { tokens: new Set(), phrase: words.join(' ') };
}
function textTokens(f) {
  const out = new Set();
  for (const m of f.matchAll(/\p{L}+/gu)) out.add(m[0]);
  for (const m of f.matchAll(/[\p{L}\p{N}]+/gu)) out.add(m[0]);
  return out;
}
// The first token of another member's name or handle found in text, or null. people: the OTHER
// members, [{name, handle}]; the writer's own name is allowed unless someone else shares a piece of it.
function nameHit(text, people) {
  const f = fold(text), words = textTokens(f);
  const flat = ' ' + [...f.matchAll(/[\p{L}\p{N}]+/gu)].map(m => m[0]).join(' ') + ' ';
  const theirs = new Set(), phrases = new Set();
  for (const p of people || []) {
    if (!p) continue;
    for (const t of nameTokens(p.name)) theirs.add(t);
    const h = handleTerms(p.handle); for (const t of h.tokens) theirs.add(t); if (h.phrase) phrases.add(h.phrase);
  }
  for (const t of theirs) {
    if (words.has(t)) return t;
    if (CONTINUA.test(t) && f.includes(t)) return t;
  }
  for (const ph of phrases) if (flat.includes(' ' + ph + ' ')) return ph;
  return null;
}

// Dares: what INSANE refuses outright. Each entry: [pattern on folded text, the reason shown].
const UNSAFE = [
  [/\b(traffic|highway|motorway|railway|train tracks?|run (across|into) the road|cross the road|in the road|on the road|stop a (car|bus)|jaywalk)\b/, 'Nothing near traffic or trains.'],
  [/\b(fire|flames?|burn|lighter|petrol|gasoline|kerosene|fireworks?|firecrackers?)\b/, 'Nothing with fire.'],
  [/\b(roof|rooftop|ledge|cliff|balcony|climb (a|the|up) [a-z]+|jump (off|from)|heights?|parapet|terrace edge)\b/, 'Nothing at heights.'],
  [/\b(alcohol|drunk|drink (a|the|\d)|tequila shots?|vodka shots?|beer|vodka|whisk(e)?y|rum|tequila|wine|daru|booze|weed|drugs?|ganja|smoke|vape)\b/, 'Nothing with alcohol, drugs or smoking.'],
  [/\b(police|cops?|security guard|steal|shoplift|trespass|graffiti|vandal|break in|illegal)\b/, 'Nothing with the police or the law.'],
  [/\b(money|cash|rupees?|rs|inr|pay for|pay (me|us|them|someone|a stranger) (rs|inr|₹|\d)|bet|loan|gamble|wallet|upi|paytm|gpay)\b|[₹$€£]/, 'Nothing with money.'],
  [/\b(touch|kiss|hug|grab|lick|tickle|slap|hit|push|follow|film|photograph|record) (a |an |some )?(random )?(stranger|stranger's|strangers|someone you don't know|a girl|a guy|a woman|a man)\b|\bstrangers'? bod(y|ies)\b/, 'Nothing with strangers’ bodies, and no filming people who didn’t agree.'],
  [/\b(knife|blade|weapon|gun|naked|nude|strip naked|underwear|self ?harm|cut yourself|starve|fast for|hold your breath|choke|blackout|pills?)\b/, 'Nothing that could hurt anyone.'],
];
function unsafeDare(text) {
  const f = ' ' + fold(text).replace(/[^\p{L}\p{N}₹$€£' ]+/gu, ' ').replace(/\s+/g, ' ') + ' ';
  for (const [re, why] of UNSAFE) if (re.test(f)) return why;
  return null;
}
// </names>

module.exports = { fold, nameTokens, handleTerms, nameHit, unsafeDare, UNSAFE };
