// INSANE content core (WS-E): pure functions with no dependencies and no I/O, shared by three places:
//   server/content.js      (the server's packs, schedule and checks)
//   tools/content.js       (copies the CLIENT block below into src/js/34-packs.js, byte for byte)
//   test/**                (content checks, PBT, the local-mode Decode answer for the legacy e2e)
// Everything between the CLIENT markers must run unchanged in the browser: plain functions, no require.
'use strict';

/* CLIENT-BEGIN */
// 32-bit FNV-1a of a string (as v0.8's fnv, but a number)
function fnv32(s){let h=0x811c9dc5;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0}return h}
// mulberry32: a small seeded generator; the same seed gives the same stream everywhere
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296}}
// a seeded Fisher-Yates permutation of 0..n-1
function seededPerm(n,scope){const r=mulberry(fnv32(scope));const p=[];for(let i=0;i<n;i++)p.push(i);for(let i=n-1;i>0;i--){const j=Math.floor(r()*(i+1));const x=p[i];p[i]=p[j];p[j]=x}return p}
// The k-th item of a fixed shuffled cycle over n items: every item comes up exactly once in any n
// consecutive k, so nothing repeats until the pool is used up, and each repeat is exactly n steps later.
function permAt(n,scope,k){if(!(n>0))return -1;const p=seededPerm(n,scope+'|'+n);return p[((k%n)+n)%n]}
// Contiguous week number from an ISO week key ("2026-W42"): weeks since Mon 5 Jan 1970
function isoWeekIdx(key){const m=/^(\d{4})-W(\d{2})$/.exec(String(key));if(!m)return NaN;const y=+m[1],w=+m[2];const j4=Date.UTC(y,0,4);const dow=(new Date(j4).getUTCDay()+6)%7;const mon=j4-dow*864e5+(w-1)*7*864e5;return Math.round((mon-Date.UTC(1970,0,5))/(7*864e5))}
// Contiguous day number from "YYYY-MM-DD"
function dayIdx(s){const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));return m?Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/864e5):NaN}
// Up to k distinct items from pool that aren't in used; when the fresh ones run out, the pool starts over
// (minus what this pick already took). rand() in [0,1). Returns {pick, used}: used is the history to keep.
function pickFresh(pool,used,k,rand){pool=[...new Set(pool)];let seen=new Set((used||[]).filter(x=>pool.includes(x)));const pick=[];
  while(pick.length<Math.min(k,pool.length)){let left=pool.filter(x=>!seen.has(x)&&!pick.includes(x));if(!left.length){seen=new Set();left=pool.filter(x=>!pick.includes(x))}
    const x=left[Math.floor(rand()*left.length)%left.length];pick.push(x);seen.add(x)}
  return {pick,used:[...seen]}}
// A Decode answer as typed: letters only, upper case
const decNorm=s=>String(s||'').toUpperCase().replace(/[^A-Z]/g,'');
// The pack for a city id ("IN-tamil_nadu-chennai"): the first pack that lists it, else the generic one
function packFor(packs,city){return packs.find(p=>(p.cities||[]).includes(city))||packs.find(p=>p.id==='generic')||packs[0]}
/* CLIENT-END */

/* ---------- puzzles: each kind is mechanical, so a checker can solve it from its data ---------- */
const MORSE = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..' };
const KEYPAD = { 2: 'ABC', 3: 'DEF', 4: 'GHI', 5: 'JKL', 6: 'MNO', 7: 'PQRS', 8: 'TUV', 9: 'WXYZ' };
const keyOf = c => +Object.keys(KEYPAD).find(k => KEYPAD[k].includes(c));
const letters = s => String(s).toUpperCase().replace(/[^A-Z]/g, '');
const words = s => String(s).split(/[^A-Za-z]+/).filter(Boolean);
const shift = (s, n) => letters(s).split('').map(c => String.fromCharCode(65 + ((c.charCodeAt(0) - 65 + n) % 26 + 26) % 26)).join('');
const atbash = s => letters(s).split('').map(c => String.fromCharCode(155 - c.charCodeAt(0))).join('');

// Work the answer out of a puzzle's data. Returns the answer, or a list of acceptable answers for the two
// kinds that are many-to-one (an anagram and an old keypad), which the checker then matches against.
const SOLVE = {
  caesar: d => shift(d.text, -d.shift),
  atbash: d => atbash(d.text),
  a1z26: d => d.nums.map(n => String.fromCharCode(64 + n)).join(''),
  morse: d => d.code.split(' ').map(x => Object.keys(MORSE).find(k => MORSE[k] === x) || '?').join(''),
  reverse: d => letters(d.text).split('').reverse().join(''),
  acrostic: d => words(d.text).map(w => w[0]).join('').toUpperCase(),
  lastletters: d => words(d.text).map(w => w[w.length - 1]).join('').toUpperCase(),
  zip: d => letters(d.text).split('').filter((c, i) => i % 2 === 0).join(''),
  anagram: d => ({ sorted: letters(d.letters).split('').sort().join('') }),
  keypad: d => ({ digits: String(d.digits).replace(/\D/g, '') }),
  hidden: d => ({ text: letters(d.text) }),
};
// Is `answer` what the puzzle's data says? (each kind solved independently of how the clue was written)
function solves(p, answer) {
  const a = decNorm(answer), f = SOLVE[p.kind];
  if (!f || !a) return false;
  const r = f(p.data || {});
  if (typeof r === 'string') return r === a;
  if (r.sorted) return a.split('').sort().join('') === r.sorted && a !== letters(p.data.letters);
  if (r.digits) return a.split('').map(keyOf).join('') === r.digits;
  if (r.text) { const i = r.text.indexOf(a); if (i < 0) return false; // hidden across a word boundary, never a whole word
    return !words(p.data.text).some(w => w.toUpperCase() === a); }
  return false;
}
// Write the clue for a puzzle's data (the generator uses this; the checker only needs the data in the clue)
const ASK = {
  caesar: d => `Shift every letter back ${d.shift} places in the alphabet: ${d.text}`,
  atbash: d => `Mirror the alphabet, so A is Z, B is Y and so on: ${d.text}`,
  a1z26: d => `A=1, B=2 … Z=26. Decode: ${d.nums.join(' · ')}`,
  morse: d => `Morse code: ${d.code}`,
  reverse: d => `Read it backwards: ${d.text}`,
  acrostic: d => `Take the first letters: ${d.text}`,
  lastletters: d => `Take the last letter of each word: ${d.text}`,
  zip: d => `Read every other letter, starting with the first: ${d.text}`,
  anagram: d => `Rearrange ${d.letters} to find this week’s word.`,
  keypad: d => `Old phone keypad: ${String(d.digits).split('').join(' · ')}`,
  hidden: d => `This week’s word is hiding in this line: “${d.text}”`,
};
// What a clue must show of its data, so the clue alone is enough to solve it
const SHOWS = {
  caesar: d => [d.text, String(d.shift)], atbash: d => [d.text], a1z26: d => d.nums.map(String), morse: d => [d.code], reverse: d => [d.text],
  acrostic: d => [d.text], lastletters: d => [d.text], zip: d => [d.text], anagram: d => [d.letters], keypad: d => String(d.digits).split(''), hidden: d => [d.text],
};
const KINDS = Object.keys(SOLVE);

// Does this text contain the answer as a word (any case)? Used for hints and every payload scan.
const hasWord = (text, answer) => new RegExp('(^|[^A-Za-z])' + answer + '($|[^A-Za-z])', 'i').test(String(text));

// Every rule a puzzle must meet. Returns a list of problems (empty = fine).
function checkPuzzle(p) {
  const bad = [], a = p && p.a;
  if (!p || typeof p !== 'object') return ['not a puzzle'];
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(String(p.id || ''))) bad.push('id must be lower-case letters, digits and dashes');
  if (!KINDS.includes(p.kind)) bad.push('kind must be one of ' + KINDS.join(', '));
  if (!/^[A-Z]{4,12}$/.test(String(a || ''))) bad.push('answer must be 4–12 letters A–Z, one word');
  if (typeof p.q !== 'string' || p.q.length < 10 || p.q.length > 220) bad.push('clue must be 10–220 characters');
  if (!Array.isArray(p.h) || p.h.length !== 3 || p.h.some(h => typeof h !== 'string' || h.length < 4 || h.length > 140)) bad.push('needs exactly 3 hints of 4–140 characters');
  if (bad.length) return bad;
  if (!solves(p, a)) bad.push(`not solvable: the ${p.kind} data does not give ${a}`);
  for (const s of SHOWS[p.kind](p.data)) if (!p.q.includes(s)) { bad.push('the clue does not show its data (' + s + ')'); break; }
  if (hasWord(p.q, a)) bad.push('the clue gives the answer away');
  p.h.forEach((h, i) => { if (hasWord(h, a)) bad.push(`hint ${i + 1} gives the answer away`); });
  return bad;
}

/* ---------- dares and Mole tasks: safe, legal, cheap ---------- */
// Refused outright in owner-written dares and Mole tasks (WS-D screens what members write; this is the
// content tool's own floor). Matched as word starts, any case.
const UNSAFE = ['traffic', 'road', 'highway', 'railway', 'fire', 'flame', 'burn*', 'height', 'roof', 'ledge', 'balcony', 'cliff', 'climb*', 'jump off', 'swim*', 'sea', 'drunk', 'alcohol', 'beer', 'wine', 'vodka', 'shot', 'smok*', 'vape', 'police', 'cop', 'money', 'cash', 'pay', 'bet', 'gambl*', 'steal*', 'shoplift*', 'trespass*', 'naked', 'strip', 'kiss*', 'touch a stranger', 'hug a stranger', 'stranger’s body', "stranger's body", 'lick*', 'eat raw', 'chilli challenge', 'prank call*', 'lie to', 'insult*', 'mock*', 'knife', 'weapon', 'drive', 'bike stunt', 'tattoo', 'pierc*', 'shave'];
// '*' marks a word start ("climb" catches "climbing"); anything else must be the whole word or its plural.
function screenText(t) {
  const s = ' ' + String(t || '').toLowerCase().replace(/\s+/g, ' ') + ' ';
  const re = w => w.endsWith('*') ? new RegExp('[^a-z]' + w.slice(0, -1)) : new RegExp('[^a-z]' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?[^a-z]');
  return UNSAFE.filter(w => re(w).test(s)).map(w => w.replace('*', ''));
}
function checkDare(d) {
  const bad = [];
  if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(String(d.id || ''))) bad.push('id must be lower-case letters, digits and dashes');
  if (typeof d.text !== 'string' || d.text.trim().length < 8 || d.text.length > 100) bad.push('text must be 8–100 characters');
  if (!(Number.isInteger(d.level) && d.level >= 1 && d.level <= 6)) bad.push('level must be 1–6');
  const u = screenText(d.text); if (u.length) bad.push('not safe for the jar: ' + u.join(', '));
  return bad;
}
function checkMole(m) {
  const bad = [];
  if (!(Number.isInteger(m.i) && m.i >= 0)) bad.push('i must be a whole number (its index; never reuse one)');
  if (typeof m.text !== 'string' || m.text.trim().length < 8 || m.text.length > 100) bad.push('text must be 8–100 characters');
  if (!(Number.isInteger(m.n) && m.n >= 1 && m.n <= 5)) bad.push('n (times to do it) must be 1–5');
  const u = screenText(m.text); if (u.length) bad.push('not safe: ' + u.join(', '));
  return bad;
}

/* ---------- weeks on the server: ISO weeks in a person's own time zone ---------- */
const DAY = 864e5, HOUR = 36e5;
function isoWeekKeyUTC(t) { const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); const y = d.getUTCFullYear(), w1 = Date.UTC(y, 0, 4); const n = 1 + Math.round(((d - w1) / DAY - 3 + ((new Date(w1).getUTCDay() + 6) % 7)) / 7); return y + '-W' + String(n).padStart(2, '0'); }
const weekStartUTC = key => Date.UTC(1970, 0, 5) + isoWeekIdx(key) * 7 * DAY;
// UTC offset (ms) of an IANA zone at instant t; 0 if unknown
function tzOffset(tz, t) {
  try {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
  } catch (e) { return 0; }
}
// The offset to judge someone's Decode week by: their stated zone, held within 3 h of what their
// longitude says (so claiming a far zone can't buy an early answer), or the longitude's own guess.
function judgeOffset(tz, lon, t) {
  const guess = isFinite(lon) ? Math.round(lon / 15) * HOUR : null, off = tz ? tzOffset(tz, t) : null;
  if (guess == null) return off || 0;
  if (off == null || !tz) return guess;
  return Math.max(guess - 3 * HOUR, Math.min(guess + 3 * HOUR, off));
}

module.exports = { fnv32, mulberry, seededPerm, permAt, isoWeekIdx, dayIdx, pickFresh, decNorm, packFor, SOLVE, ASK, SHOWS, KINDS, solves, checkPuzzle, hasWord, letters, shift, atbash, MORSE, KEYPAD, keyOf, UNSAFE, screenText, checkDare, checkMole, isoWeekKeyUTC, weekStartUTC, tzOffset, judgeOffset, DAY, HOUR };
