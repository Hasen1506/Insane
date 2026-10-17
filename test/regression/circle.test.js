// WS-C regressions (PLAN-V09 §5.e), one per live-test bug, on the page's own code in a vm (no browser, fast).
// Each states what the live test saw, and checks the screen-level string the person would read.
'use strict';
const { loadV09 } = require('../lib/load');
const T = Date.UTC(2026, 9, 12, 5, 0);

function fresh(extra = {}) {
  const app = loadV09(); app.setNow(T);
  app.run(`globalThis.__writes=[];globalThis.__fail=false;
    const __q=p=>({where:()=>__q(p),orderBy:()=>__q(p),limit:()=>__q(p),get:async()=>({docs:[],size:0}),onSnapshot:()=>()=>{},doc:id=>__d(p+'/'+id),
      add:async d=>{await Promise.resolve();if(__fail)throw {code:'unavailable'};__writes.push(['add',p,d]);return __d(p+'/x')}});
    const __d=p=>({path:p,get:async()=>({exists:true,data:()=>({})}),onSnapshot:()=>()=>{},collection:c=>__q(p+'/'+c),
      update:async d=>{if(__fail)throw {code:'unavailable'};__writes.push(['update',p,d])},set:async d=>{__writes.push(['set',p,d])}});
    S.db={doc:__d,collection:__q};`);
  app.ctx.__st = Object.assign({
    uid: 'u_k', backend: 'local', priv: {},
    me: { name: 'Kavya', circle: 'cA', circles: ['cA'], city: 'IN-chennai', cityName: 'Chennai', cell: { lat: 13, lon: 80, s: 1, b: [0, 0, 1, 1] }, joined: T - 1e9, radius: 5, quiet: { from: 2, to: 3 } },
    circle: { id: 'cA', name: 'Mylapore Mad Hatters', code: 'ABCDEF', members: ['u_k', 'u_a'] },
    members: [{ id: 'u_k', name: 'Kavya', circles: ['cA'] }, { id: 'u_a', name: 'Arjun', circles: ['cA'] }],
  }, extra);
  app.run('Object.assign(S,__st);S.cid=S.me.circle');
  return app;
}

module.exports = async function (t) {
  { // R-C20: "Meera Krishnamurthy-Venkataraghavan 🌶️🔥" was cut to "Meera Krishnamurthy-Venk"
    const app = fresh(), clip = app.get('clip');
    const n = clip('Meera Krishnamurthy-Venkataraghavan 🌶️🔥', 40);
    t.ok('R-C20 a long name is never cut mid-word or mid-emoji', n === 'Meera Krishnamurthy-Venkataraghavan', n);
  }
  { // R-C27: the code was only in a 3.2 s toast
    const app = fresh(), it = app.run('homeItems()');
    t.ok('R-C27 with 2 of 3, Home’s first card is the invite with the code, Share, WhatsApp and Copy link', it[0].k === 'invite' && /ABCDEF/.test(it[0].html) && /data-act="share"/.test(it[0].html) && /wa\.me/.test(it[0].html) && /data-act="copy"/.test(it[0].html));
    app.run(`S.members.push({id:'u_r',name:'Ravi',circles:['cA']})`);
    t.ok('R-C27 at 3 people the invite card goes', !app.run('homeItems()').some(i => i.k === 'invite'));
  }
  { // R-C29: "1 thing today" sat above "Nothing on the go"; R-C30: the plan to answer was the last card
    const app = fresh({ threads: [{ id: 'p1', kind: 'plan', title: 'Climbing, then pho', by: 'u_a', at: T - 1000, going: { u_a: true } }], daily: {} });
    const html = app.run('vToday()'), it = app.run('homeItems()');
    const n = it.filter(i => i.n).length, m = /(\d+) things? needs? you/.exec(html);
    t.ok('R-C29 the count names what it counts and matches the rows drawn', !!m && +m[1] === n, m && m[0]);
    const iPlan = html.indexOf('Climbing, then pho'), iDec = html.indexOf('Decode · week'), iNoth = html.indexOf('Nothing on the go');
    t.ok('R-C30 Kavya: the plan to answer comes before the Decode and "Nothing on the go"', iPlan > -1 && iPlan < iDec && iPlan < iNoth, [iPlan, iDec, iNoth].join(','));
  }
  { // R-C33: the Decode clue was the biggest type on Home
    const app = fresh(), html = app.run('decodeCard(true)');
    t.ok('R-C33 Home’s Decode is a one-line teaser without the clue', !/<h3/.test(html) && /Decode · week/.test(html) && !html.includes(app.run('decodeClue().q')));
  }
  { // R-C32: the empty drops card looked disabled
    const app = fresh(), it = app.run('homeItems()').find(i => i.k === 'drops');
    t.ok('R-C32 no drops: one line with Host one, not a dashed card', !!it && /drops0/.test(it.html) && !/card dash/.test(it.html) && /Host one/.test(it.html));
  }
  { // R-C34: a red dot on City for a brand-new person
    const app = fresh({ me: { name: 'New', circle: null, circles: [], city: 'IN-chennai', cityName: 'Chennai', cell: { lat: 13, lon: 80, s: 1 }, joined: T - 60e3, radius: 5 }, circle: null, members: [],
      posts: [{ id: 'x', by: 'u_z', at: T - 864e5, text: 'old' }], midnight: [{ id: 'm', releaseAt: T - 864e5 }] });
    const b = app.run('badges()');
    t.ok('R-C34 a fresh person: no dots for things from before they joined', !b.city && !b.circle && !b.ledger, JSON.stringify(b));
    app.run(`S.posts.push({id:'y',by:'u_z',at:${T}-1000,text:'new'})`);
    t.ok('R-C34 …and a post after they joined does dot City', !!app.run('badges()').city);
  }
  { // R-C36: one circle per person ("You're already in a circle. Leave it first to join")
    const app = fresh();
    t.ok('R-C36 the cap comes from the server (hello.maxCircles), 3 without one', app.run('maxCircles()') === 3 && app.run(`(S.hello={maxCircles:1},maxCircles())`) === 1 && app.run(`(S.hello={maxCircles:2},maxCircles())`) === 2);
    app.run('S.hello={maxCircles:2}');
    t.ok('R-C36 inCircles() puts the new one first and keeps the rest', JSON.stringify(app.run(`inCircles('cB')`)) === '{"circle":"cB","circles":["cB","cA"]}');
    app.run(`S.me.circles=['cA','cB']`);
    t.ok('R-C36 at the limit fullUp() says so instead of "leave it first"', app.run('fullUp()') === 1 && /You’re in 2 circles, the most there is/.test(app.run('S.toast')));
    app.run('S.hello={maxCircles:1};S.me.circles=["cA"]');
    t.ok('R-C36 with MAX_CIRCLES=1 it reads as v0.8 did', app.run('fullUp()') === 1 && /already in a circle/.test(app.run('S.toast')));
  }
  { // R-C38: no message states; a failed send vanished; a double tap sent twice
    const app = fresh({ ui: Object.assign({}, { tab: 'circle', cseg: 'chat', sseg: 'map', open: { type: 'thread', id: 'general' }, sheet: null, f: {}, ob: {}, confirm: null }), msgs: [], threads: [{ id: 'general', kind: 'talk', title: 'General', muted: true }] });
    app.run(`S.ui.f=F;F.msg='on my way'`);
    await app.run(`Promise.all([ACT.send({}),(F.msg='on my way',ACT.send({}))])`);
    const adds = app.run(`__writes.filter(w=>w[0]==='add').length`);
    t.ok('R-C38 the same text twice while the first is in flight is stored once', adds === 1, adds);
    app.run(`__fail=true;F.msg='سلام'`); await app.run('ACT.send({})');
    t.ok('R-C38 a failed send stays on screen as Not sent, with Retry, text kept', app.run(`S.outbox.length===1&&S.outbox[0].st==='failed'`) && /Not sent/.test(app.run('vThread()')) && /send-retry/.test(app.run('vThread()')) && app.run('vThread()').includes('سلام'), JSON.stringify(app.run('S.outbox')) + app.run('vThread()').slice(-500));
    app.run('__fail=false'); await app.run(`ACT['send-retry']({v:S.outbox[0].id})`);
    t.ok('R-C38 Retry sends it once and clears the state', app.run('S.outbox.length') === 0 && app.run(`__writes.filter(w=>w[0]==='add'&&w[2].text==='سلام').length`) === 1);
  }
  { // R-C45: "Posted." but the list said "No open calls in Chennai"
    const app = fresh({ calls: [{ id: 'c1', circle: 'cA', cname: 'Mylapore Mad Hatters', ask: 'a 4th for quiz night', at: T - 1000 }], circle: { id: 'cA', name: 'Mylapore Mad Hatters', code: 'ABCDEF', members: ['u_k', 'u_a'], verified: { u_k: true, u_a: true } } });
    const html = app.run('cityCalls()');
    t.ok('R-C45 your own call is listed under "Your circle’s calls", with Close', /Your circle’s calls/.test(html) && html.includes('a 4th for quiz night') && /data-act="cdel"[^>]*>Close it/.test(html) && !html.includes('No open calls in Chennai.'), html.slice(0, 400));
  }
  { // R-C47: an empty league table with a dense paragraph
    const app = fresh(), html = app.run('cityLeague()');
    t.ok('R-C47 the league says your points and the next step; the rules are folded away', /Mylapore Mad Hatters: 0 points/.test(html) && /Next: solve the Decode/.test(html) && /<details class="rules">/.test(html));
  }
  { // R-C53 (WS-C part): "₹1500" on Home, in Circle and in the pledge toast
    const pot = { id: 'p1', kind: 'pot', mode: 'pledge', title: 'Goa', by: 'u_a', at: T - 1000, cur: '₹', per: 1500, min: 3, pledges: { u_a: true }, paid: {} };
    const app = fresh({ threads: [pot] });
    const home = app.run('homeItems().map(i=>i.html).join("")'), circ = app.run('circleChat()+threadPanel(S.threads[0])');
    t.ok('R-C53 Home and Circle say ₹1,500, never ₹1500', home.includes('₹1,500') && circ.includes('₹1,500') && !/₹1500/.test(home + circ));
    await app.run(`ACT.pledge({v:'p1'})`);
    t.ok('R-C53 the pledge toast says ₹1,500', /Pledged ₹1,500/.test(app.run('S.toast')), app.run('S.toast'));
  }
  { // R-C73: "You're in." from Circle was still showing on Ledger
    const app = fresh();
    app.run(`S.ui.tab='circle';toast('You’re in.')`); app.run(`S.ui.tab='ledger';toastHtml()`);
    t.ok('R-C73 a toast is cleared by a tab change', app.run('S.toast') === null);
    app.run(`toast('one');toast('two')`);
    t.ok('R-C73 a new toast replaces the last: one at a time', app.run('S.toast') === 'two');
    t.ok('R-C73 creating a circle no longer puts the code in a toast', !/Send your friends the code/.test(require('fs').readFileSync(require('path').join(__dirname, '../../src/js/71-onboarding.js'), 'utf8')));
  }
};
