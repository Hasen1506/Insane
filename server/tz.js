// Time zones on the server (C102), no dependencies: Intl does the zone rules, this does the arithmetic.
// The server runs in UTC on Render, so nothing here may use the process's local time.
'use strict';
const DAY = 864e5;
const DEFAULT_TZ = process.env.DEFAULT_TZ || 'Asia/Kolkata';

const fmts = new Map();
function fmt(tz) {
  let f = fmts.get(tz);
  if (!f) { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short' }); fmts.set(tz, f); }
  return f;
}
function validTz(tz) { if (typeof tz !== 'string' || !tz || tz.length > 64) return false; try { fmt(tz); return true; } catch (e) { return false; } }
const zoneOr = (tz, fallback = DEFAULT_TZ) => validTz(tz) ? tz : fallback;

// Wall-clock parts of instant t in tz.
function parts(t, tz) {
  const o = {}; for (const p of fmt(tz).formatToParts(new Date(t))) o[p.type] = p.value;
  return { y: +o.year, mo: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) };
}
// tz's offset from UTC at instant t, in ms (local = utc + offset).
function offset(t, tz) { const p = parts(t, tz); return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000; }

// The instant of local wall time y-mo-d h:mi in tz. A time skipped by a DST jump resolves to the first
// instant after the gap; a repeated time resolves to its first occurrence.
function instant(y, mo, d, h, mi, tz) {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const cands = [];
  for (const g of [wall - offset(wall - DAY, tz), wall - offset(wall, tz), wall - offset(wall + DAY, tz)]) {
    const p = parts(g, tz); if (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) === wall) cands.push(g);
  }
  if (cands.length) return Math.min(...cands);
  // in a gap: walk forward a minute at a time to the first real minute (gaps are at most a few hours)
  for (let g = wall - offset(wall - DAY, tz); g < wall + DAY; g += 6e4) { const p = parts(g, tz); if (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) >= wall) return g; }
  return wall - offset(wall, tz);
}

// The next local 00:00 in tz strictly after t (or the start of the first real minute after it, if 00:00 is skipped).
function nextMidnight(t, tz) {
  const p = parts(t, tz), n = new Date(Date.UTC(p.y, p.mo - 1, p.d + 1));
  return instant(n.getUTCFullYear(), n.getUTCMonth() + 1, n.getUTCDate(), 0, 0, tz);
}
// The local 00:00 in tz nearest to t: the release a client asked for, read in the circle's zone.
function nearestMidnight(t, tz) {
  const p = parts(t, tz), here = instant(p.y, p.mo, p.d, 0, 0, tz), next = nextMidnight(t, tz);
  return t - here <= next - t ? here : next;
}
const localHour = (t, tz) => parts(t, zoneOr(tz)).h;
// A day key 'YYYY-MM-DD' in tz, for daily resets and counts.
function dayKey(t, tz = DEFAULT_TZ) { const p = parts(t, zoneOr(tz)); return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`; }

module.exports = { DEFAULT_TZ, validTz, zoneOr, parts, offset, instant, nextMidnight, nearestMidnight, localHour, dayKey };
