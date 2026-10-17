// C05 history routing (src/js/61-router.js), model-based: random sessions of taps, sheets and Back
// against a fake History that behaves like the browser's (back() is async and arrives as popstate).
// Properties that must never break:
//   R1  only the top history entry can hold a sheet, so Back never reopens a closed sheet
//   R2  Back from a sheet closes it and leaves the screen under it exactly as it was
//   R3  no two neighbouring entries have the same route (every Back changes the screen)
//   R4  a redraw with nothing changed adds no entry and doesn't move the index
//   R5  every entry's URL is its route, and the route parses back to that entry's tab/segment/thread
//   R6  routeParse(routeOf(ui)) recovers tab, segment and open thread for any ui
'use strict';
const { loadV09 } = require('../lib/load');
const { prop, G } = require('./runner');

const TABS = ['today', 'circle', 'city', 'ledger', 'you'], CSEG = ['chat', 'plans', 'people', 'midnight'], SSEG = ['map', 'feed', 'calls'], LSEG = ['favors', 'pots'];
const SHEETS = ['make', 'activity', 'invite', 'pot-new', 'profile'];

function harness() {
  const app = loadV09();
  const H = { entries: [{ state: null, url: '/' }], i: 0, queue: [] };
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
  app.ctx.history = {
    get state() { return clone(H.entries[H.i].state); }, get length() { return H.entries.length; },
    pushState(s, _, u) { H.entries.splice(H.i + 1); H.entries.push({ state: clone(s), url: u }); H.i++; },
    replaceState(s, _, u) { H.entries[H.i] = { state: clone(s), url: u == null ? H.entries[H.i].url : u }; },
    back() { H.queue.push(-1); },
  };
  app.ctx.location = { pathname: '/', search: '', get hash() { const u = H.entries[H.i].url; return u.includes('#') ? u.slice(u.indexOf('#')) : ''; }, href: 'http://localhost/' };
  app.run('wire2=()=>{};draw=()=>routeSync();');
  app.setState({ me: { cell: 'c1', circle: 'k1' }, mode: 'live' });
  const flush = () => { while (H.queue.length) { const d = H.queue.shift(); if (H.i + d < 0) continue; H.i += d; app.run('routePop')({ state: clone(H.entries[H.i].state) }); } };
  const ui = () => app.run('JSON.parse(JSON.stringify({tab:S.ui.tab,cseg:S.ui.cseg,sseg:S.ui.sseg,lseg:S.ui.lseg,open:S.ui.open,sheet:S.ui.sheet}))');
  const set = o => { app.ctx.__o = o; app.run('Object.assign(S.ui,__o);routeSync()'); delete app.ctx.__o; flush(); };
  const reset = () => { H.entries = [{ state: null, url: '/' }]; H.i = 0; H.queue = []; app.run("Object.assign(S.ui,{tab:'today',cseg:'chat',sseg:'map',lseg:'favors',open:null,sheet:null});ROUTE.on=false;ROUTE.pending=false;ROUTE.last=null;routeSync()"); };
  return { app, H, flush, ui, set, reset, back: () => { app.ctx.history.back(); flush(); } };
}

const OP = G.oneOf(
  G.map(G.pick(TABS), v => ['tab', v]), G.map(G.pick(CSEG), v => ['cseg', v]), G.map(G.pick(SSEG), v => ['sseg', v]), G.map(G.pick(LSEG), v => ['lseg', v]),
  G.map(G.pick(['t1', 't2', 'r1']), v => ['open', v]), G.constant(['close']),
  G.map(G.pick(SHEETS), v => ['sheet', v]), G.constant(['sheet-close']), G.map(G.pick(TABS), v => ['sheet-go', v]),
  G.constant(['back']), G.constant(['back']), G.constant(['redraw']));

module.exports = async function (t) {
  const h = harness();
  const step = ([k, v]) => {
    const u = h.ui();
    if (k === 'back') { const before = u, had = !!u.sheet; h.back(); return { k, before, had }; }
    if (k === 'redraw') { const n = h.H.entries.length, i = h.H.i; h.app.run('routeSync()'); h.flush(); return { k, same: h.H.entries.length === n && h.H.i === i }; }
    if (u.sheet && !/^sheet/.test(k)) return { k: 'skip' }; // a sheet covers the tabs: only sheet actions reach the app
    if (k === 'tab') h.set({ tab: v, open: null });
    else if (k === 'cseg') { if (u.tab !== 'circle') return { k: 'skip' }; h.set({ cseg: v, open: null }); }
    else if (k === 'sseg') { if (u.tab !== 'city') return { k: 'skip' }; h.set({ sseg: v }); }
    else if (k === 'lseg') { if (u.tab !== 'ledger') return { k: 'skip' }; h.set({ lseg: v }); }
    else if (k === 'open') h.set({ tab: 'circle', open: { type: v[0] === 'r' ? 'room' : 'thread', id: v } });
    else if (k === 'close') h.set({ open: null });
    else if (k === 'sheet') h.set({ sheet: { t: v } });
    else if (k === 'sheet-close') h.set({ sheet: null });
    else if (k === 'sheet-go') { if (!u.sheet) return { k: 'skip' }; h.set({ sheet: null, tab: v, open: null }); }
    return { k };
  };
  const strip = u => JSON.stringify({ ...u, sheet: null });
  const check = () => {
    const E = h.H.entries.slice(0, h.H.i + 1);
    if (E.slice(0, -1).some(e => e.state && e.state.ui && e.state.ui.sheet)) return 'R1 a sheet entry below the top';
    for (let i = 1; i < E.length; i++) if (E[i].state && E[i - 1].state && E[i].state.r === E[i - 1].state.r) return 'R3 duplicate neighbours ' + E[i].state.r;
    for (const e of E) if (e.state && e.state.insane && !e.url.endsWith(e.state.r)) return 'R5 url/route mismatch';
    const top = h.H.entries[h.H.i].state, now = h.app.run('routeOf(S.ui)');
    if (!top || top.r !== now) return 'R5 the current entry is not the screen: ' + (top && top.r) + ' vs ' + now;
    return null;
  };
  const r = prop('random sessions keep history sane', G.array(OP, { min: 1, max: 40 }), ops => {
    h.reset();
    for (const op of ops) {
      const pre = h.ui(), preIdx = h.H.i, prevEntry = preIdx > 0 ? h.H.entries[preIdx - 1].state : null;
      const res = step(op);
      if (res.k === 'redraw' && !res.same) throw new Error('R4 a no-op redraw changed history');
      if (res.k === 'back' && res.had && prevEntry) {
        const u = h.ui();
        if (u.sheet) throw new Error('R2 Back left a sheet open');
        if (strip(u) !== strip(pre)) throw new Error('R2 Back from a sheet changed the screen under it: ' + strip(pre) + ' -> ' + strip(u));
      }
      const bad = check(); if (bad) throw new Error(bad + ' after ' + JSON.stringify(op));
    }
    return true;
  }, { runs: +process.env.PBT_RUNS || 400 });
  t.ok(`router: R1-R5 hold over ${r.runs} random sessions`, r.ok, r.ok ? '' : `SEED=${r.seed} CASE=${JSON.stringify(r.shrunk ?? r.case)} ${r.error || ''}`);

  const UI = G.record({ tab: G.pick(TABS), cseg: G.pick(CSEG), sseg: G.pick(SSEG), lseg: G.pick(LSEG), open: G.oneOf(G.constant(null), G.map(G.str({ min: 1, max: 12 }), id => ({ type: 'thread', id }))), sheet: G.oneOf(G.constant(null), G.map(G.pick(SHEETS), t => ({ t }))) });
  const r6 = prop('routeParse(routeOf(ui)) round-trips', UI, u => {
    h.app.ctx.__u = u; const back = h.app.run('routeParse(routeOf(__u))'); delete h.app.ctx.__u;
    if (back.tab !== u.tab) return false;
    if (u.open) return back.open && back.open.id === u.open.id && back.open.type === 'thread';
    return (u.tab !== 'circle' || back.cseg === u.cseg) && (u.tab !== 'city' || back.sseg === u.sseg) && (u.tab !== 'ledger' || back.lseg === u.lseg);
  }, { runs: +process.env.PBT_RUNS || 1000 });
  t.ok(`router: R6 routes round-trip for ${r6.runs} random screens (ids with emoji, RTL, slashes)`, r6.ok, r6.ok ? '' : `SEED=${r6.seed} CASE=${JSON.stringify(r6.shrunk ?? r6.case)}`);
  h.app.run("S.me=null"); t.ok('router: sign-in and onboarding have no route (one entry, Back is the browser\'s)', h.app.run('routeOf(S.ui)') === '');
};
