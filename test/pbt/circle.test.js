// WS-C properties (PLAN-V09 §5.b), on the page's own code in a vm (test/lib/load):
//   C36  the switcher never shows circle B's data while A is on screen: random switches between up to three
//        circles, with snapshots delivered late, out of order, and from subscriptions already swapped out
//   P21  Home: the lede's count is the rows drawn that need you; nothing that needs you ranks below the daily
//        dare, the Decode, circle news or drops (C29, C30)
//   C20  clip() never cuts a grapheme (emoji, ZWJ, flags, Tamil, Devanagari, Arabic marks), stays within n, is a
//        prefix of the trimmed text, and the page and the server (server/text.js) agree on every input (P22)
//   C73  at most one toast, it is the last one asked for, and it never survives a tab change
'use strict';
const { prop, G } = require('./runner');
const { loadV09 } = require('../lib/load');
const { clip: serverClip } = require('../../server/text');
const RUNS = +process.env.PBT_RUNS || 1000;
const T = Date.UTC(2026, 9, 12, 5, 0); // Mon 12 Oct 2026, 10:30 in Chennai

module.exports = async function (t) {
  const report = (name, r) => t.ok(name, r.ok, r.message);

  /* ---------- C20 / P22: clip ---------- */
  {
    const app = loadV09(), clip = app.get('clip');
    const seg = new Intl.Segmenter();
    const wholePrefix = (s, out) => { let acc = ''; if (out === '') return true; for (const g of Array.from(seg.segment(s), x => x.segment)) { acc += g; if (acc === out || acc.trimEnd() === out) return true; if (acc.length > out.length + 8) return false; } return false; };
    const TRICKY = ['👨‍👩‍👧', '🇮🇳', '👍🏽', '❤️', 'சென்னை', 'கூ', 'हिन्दी', 'مُحَمَّد', 'كافيا', 'é', ' ', ' ', '-'];
    const strG = G.oneOf(G.str({ max: 70 }), G.map(G.array(G.pick(TRICKY), { max: 40 }), a => a.join('')));
    report('C20 clip: within n, whole graphemes only, a prefix of the trimmed text, page = server', prop('clip', G.tuple(strG, G.int(1, 48)), ([s, n]) => {
      const a = clip(s, n), b = serverClip(s, n), tr = s.trim();
      if (a !== b) throw new Error(`page ${JSON.stringify(a)} ≠ server ${JSON.stringify(b)}`);
      if (tr.length <= n) return a === tr;
      if (a.length > n) throw new Error('longer than n');
      if (!wholePrefix(tr, a)) throw new Error('not whole graphemes of the text: ' + JSON.stringify(a));
      return true;
    }, { runs: RUNS * 3 }));
    const cases = [
      ['Meera Krishnamurthy-Venkataraghavan 🌶️🔥', 40, 'Meera Krishnamurthy-Venkataraghavan'], // C20's own example: v0.8 gave "…-Venk"
      ['Mylapore Mad Hatters with a very long circle name indeed', 28, 'Mylapore Mad Hatters with a'],
      ['👨‍👩‍👧👨‍👩‍👧', 9, '👨‍👩‍👧'], ['சென்னைசென்னை', 7, 'சென்னை'], ['كافيا Kavya', 6, 'كافيا'],
    ];
    for (const [s, n, want] of cases) t.ok(`C20 clip(${JSON.stringify(s)}, ${n}) = ${JSON.stringify(want)}`, clip(s, n) === want && serverClip(s, n) === want, clip(s, n));
  }

  /* ---------- C36: circle isolation through switches and late snapshots ---------- */
  {
    const app = loadV09(); app.setNow(T);
    // A fake store: every subscription is kept (live or not) so the test can fire any of them, at any time.
    app.run(`globalThis.__subs=[];
      const __q=(p,w=[])=>({path:p,where:(f,op,v)=>__q(p,[...w,[f,op,v]]),orderBy:()=>__q(p,w),limit:()=>__q(p,w),get:async()=>({docs:[],size:0}),
        onSnapshot(fn){const s={p,w,fn,live:true};__subs.push(s);return()=>{s.live=false}},doc:id=>__d(p+'/'+id)});
      const __d=p=>({path:p,get:async()=>({exists:false,data:()=>undefined}),onSnapshot(fn){const s={p,w:[],fn,live:true,doc:1};__subs.push(s);return()=>{s.live=false}},update:async()=>{},set:async()=>{},collection:c=>__q(p+'/'+c)});
      S.db={doc:__d,collection:__q};S.uid='u_k';`);
    const CIDS = ['cA', 'cB', 'cC'];
    const cidOf = s => { const m = /^circles\/([^/]+)/.exec(s.p); if (m) return m[1]; const w = s.w.find(x => x[0] === 'circles' || x[0] === 'circle'); return w ? w[2] : null; };
    // what a snapshot from subscription s carries: docs tagged with the circle it was opened for
    app.run(`globalThis.__fire=(s,cid,n)=>{const tag={cid};
      if(s.doc){const data=s.p.startsWith('circles/')&&s.p.split('/').length===2?{name:'Name-'+cid,code:'CODE'+cid,members:['u_k'],cid}:{cid,id:'d-'+cid,text:'T-'+cid};
        s.fn({id:s.p.split('/').pop(),exists:true,data:()=>JSON.parse(JSON.stringify(data))});return}
      const docs=Array.from({length:n},(_,i)=>({id:cid+'-'+i,data:()=>({cid,title:'T-'+cid,name:'P-'+cid,circles:[cid],by:'u_x',at:${T}-i,releaseAt:${T}+9e9,openAt:${T}+9e9,exp:${T}+9e9,week:weekKey(),status:'open',asker:'u_x',kind:'talk',ids:['u_k','u_x'],last:{by:'u_x',name:'P-'+cid,text:'T-'+cid,at:${T}}})}));
      s.fn({docs,size:docs.length,empty:!docs.length,docChanges:()=>[]})};`);
    const opG = G.oneOf(
      G.map(G.pick(CIDS), c => ({ op: 'switch', c })),
      G.map(G.tuple(G.int(0, 400), G.int(0, 3)), ([i, n]) => ({ op: 'fire', i, n })),
      G.map(G.tuple(G.int(0, 400), G.int(0, 3)), ([i, n]) => ({ op: 'fire', i, n })),
    );
    const SCOPED = ['threads', 'members', 'midnight', 'sealed', 'rooms', 'favors', 'dares', 'clips', 'cheers', 'votes'];
    report('C36 the switcher never shows another circle’s data: state and the drawn Home, Circle and header', prop('isolation', G.array(opG, { min: 1, max: 30 }), ops => {
      app.run(`__subs.length=0;for(const k in SUBS)drop(k);S.cid=undefined;S.ui.open=null;S.ui.tab='today';S.cnames={};
        S.me={name:'Kavya',circle:'cA',circles:${JSON.stringify(CIDS)},city:'IN-chennai',cityName:'Chennai',cell:{lat:13,lon:80,s:1,b:[0,0,1,1]},joined:${T}-1e9,radius:5};S.priv={};wire2();`);
      for (const o of ops) {
        if (o.op === 'switch') app.run(`S.me=Object.assign({},S.me,{circle:${JSON.stringify(o.c)}});wire2()`);
        else {
          const subs = app.run('__subs'); if (!subs.length) continue;
          const s = subs[o.i % subs.length], c = cidOf(s); if (!c) continue;
          app.ctx.__s = s; app.run(`__fire(globalThis.__s,${JSON.stringify(c)},${o.n})`); // live or swapped out: late snapshots happen
        }
        const bad = app.run(`(()=>{const c=S.me.circle,b=[];
          for(const k of ${JSON.stringify(SCOPED)})for(const d of S[k]||[])if(d.cid&&d.cid!==c)b.push(k+':'+d.cid);
          for(const d of Object.values(S.progress||{}))if(d.cid&&d.cid!==c)b.push('progress');
          for(const k of ['daily','mole','moleLast'])if(S[k]&&S[k].cid&&S[k].cid!==c)b.push(k);
          if(S.circle&&S.circle.id!==c)b.push('circle:'+S.circle.id);
          const html=(S.circle?vToday()+vCircle()+header():'');for(const o of ${JSON.stringify(CIDS)})if(o!==c&&(html.includes('T-'+o)||html.includes('Name-'+o)||html.includes('P-'+o)))b.push('drawn:'+o);
          return b})()`);
        if (bad.length) throw new Error('on screen ' + app.run('S.me.circle') + ' but holds ' + bad.join(','));
      }
      return true;
    }, { runs: Math.max(150, RUNS / 4) }));
  }

  /* ---------- P21: Home order and count ---------- */
  {
    const app = loadV09(); app.setNow(T);
    app.run(`S.db={doc:()=>({get:()=>new Promise(()=>{}),set:async()=>{},update:async()=>{}}),collection:()=>({doc:()=>({set:async()=>{}})})}`);
    const HOME_ORDER = app.get('HOME_ORDER');
    const stG = G.record({
      members: G.int(1, 8), dares: G.int(0, 3), favDone: G.int(0, 2), favOpen: G.int(0, 2), plans: G.int(0, 3), pacts: G.int(0, 5), ticked: G.int(0, 5),
      daily: G.bool(), dailyDone: G.bool(), solved: G.bool(), unread: G.int(0, 3), circle: G.bool(), quiet: G.bool(),
    });
    report('P21 the lede counts exactly the rows drawn that need you; needs-you never ranks below dare, Decode, news or drops', prop('home', stG, s => {
      const ids = Array.from({ length: s.members }, (_, i) => i ? 'u' + i : 'u_k');
      const pr = {}; for (let i = 0; i < s.pacts; i++) pr['j_' + i] = { lane: 'need', text: 'run', read: { kind: 'Pact', what: 'Run ' + i, how: '3 a week', goal: 3, note: '' }, created: T - 5 * 864e5, status: 'active', ticks: i < s.ticked ? [new Date(T + 5.5 * 36e5).toISOString().slice(0, 10)] : [], rung: 0 };
      app.ctx.__st = {
        uid: 'u_k', backend: 'local', priv: pr,
        me: { name: 'Kavya', circle: s.circle ? 'cA' : null, circles: s.circle ? ['cA'] : [], city: 'IN-chennai', cityName: 'Chennai', cell: { lat: 13, lon: 80, s: 1, b: [0, 0, 1, 1] }, joined: T - 1e9, radius: 5, quiet: s.quiet ? { from: 0, to: 23 } : { from: 23, to: 8 } },
        circle: s.circle ? { id: 'cA', name: 'Alpha', code: 'ABCDEF', members: ids } : null,
        members: s.circle ? ids.map(id => ({ id, name: 'N' + id, circles: ['cA'] })) : [],
        dares: Array.from({ length: s.dares }, (_, i) => ({ id: 'd' + i, to: 'u_k', by: 'u1', text: 'dare ' + i, level: 2, at: T - 1000, status: i % 2 ? 'accepted' : 'open' })),
        favors: [...Array.from({ length: s.favDone }, (_, i) => ({ id: 'fd' + i, status: 'done', asker: 'u_k', doer: 'u1', what: 'x', h: 1, at: T - 1000 })), ...Array.from({ length: s.favOpen }, (_, i) => ({ id: 'fo' + i, status: 'open', asker: 'u1', what: 'y', h: 1, at: T - 1000 }))],
        threads: [...Array.from({ length: s.plans }, (_, i) => ({ id: 'p' + i, kind: 'plan', title: 'Plan ' + i, by: 'u1', at: T - 1000, going: { u1: true } })), ...Array.from({ length: s.unread }, (_, i) => ({ id: 't' + i, kind: 'talk', title: 'Talk ' + i, by: 'u1', at: T - 9000, last: { by: 'u1', name: 'N', text: 'hi', at: T - 500 } }))],
        daily: s.daily && s.dailyDone ? { done: { u_k: { at: T } } } : {},
        solves: s.solved ? [{ id: 's1', uid: 'u_k', at: T - 100, hints: 0, city: 'IN-chennai' }] : [],
      };
      app.run('Object.assign(S,__st);S.progress={};S.midnight=[];S.sealed=[];S.mole=null;S.moleLast=null;S.votes=[];S.rooms=[];S.drops=[];S.missions=[]');
      const it = app.run('homeItems()'), rank = it.map(i => HOME_ORDER.indexOf(i.k));
      if (rank.some(r => r < 0)) throw new Error('unknown kind ' + it.map(i => i.k));
      for (let i = 1; i < rank.length; i++) if (rank[i] < rank[i - 1]) throw new Error('out of order: ' + it.map(i => i.k).join(','));
      const n = it.filter(i => i.n).length, html = app.run('vToday()');
      const m = /<b[^>]*>(\d+) things? needs? you<\/b>/.exec(html);
      if (n ? !m || +m[1] !== n : !!m) throw new Error(`lede ${m && m[1]} vs ${n} rows that need you`);
      if (!it.every(i => html.includes(i.html))) throw new Error('a row is counted but not drawn');
      const needs = app.run('needsYou()').length;
      if (it.filter(i => i.k === 'needs').length !== needs) throw new Error('needs-you rows ≠ needsYou()');
      return true;
    }, { runs: RUNS }));
  }

  /* ---------- C73: one toast at a time, gone on a tab change ---------- */
  {
    const app = loadV09(); app.setNow(T);
    const opG = G.oneOf(G.map(G.str({ min: 1, max: 12 }), m => ({ op: 'toast', m })), G.map(G.pick(['today', 'circle', 'city', 'ledger', 'you']), v => ({ op: 'tab', v })), G.constant({ op: 'timeout' }));
    report('C73 one toast at most, the last asked for, never across a tab change', prop('toasts', G.array(opG, { min: 1, max: 25 }), ops => {
      app.run(`S.ui.tab='today';toast(null)`); let last = null;
      for (const o of ops) {
        if (o.op === 'toast') { app.ctx.__m = o.m; app.run('toast(globalThis.__m);toastHtml()'); last = String(o.m); } // toastHtml(): the draw that shows it, before the next tap
        else if (o.op === 'tab') { const was = app.run('S.ui.tab'); app.ctx.__v = o.v; app.run('S.ui.tab=globalThis.__v;toastHtml()'); if (was !== o.v) last = null; }
        else { app.run('toast(null)'); last = null; } // the 3.2 s timer's own call
        const cur = app.run('S.toast');
        if (cur !== last) throw new Error(`showing ${JSON.stringify(cur)}, expected ${JSON.stringify(last)}`);
        if (typeof cur !== 'string' && cur !== null) throw new Error('S.toast is not one message');
      }
      return true;
    }, { runs: RUNS }));
  }
};
