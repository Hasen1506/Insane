/* ---------- state ---------- */
const S={mode:'boot',db:null,uid:null,user:null,canWrite:true,isOwner:false,realName:'',
  me:undefined,priv:{},ev:null,circle:null,threads:[],members:[],progress:{},midnight:[],sealed:[],msgs:[],
  solves:[],drops:[],checkins:[],posts:[],calls:[],rooms:[],met:[],people:{},dropIns:[],
  favors:[],dares:[],daily:{},clips:[],cheers:[],mole:null,moleLast:null,votes:[],missions:[],trails:[],stamps:[],
  ui:{tab:'today',cseg:'chat',sseg:'map',open:null,sheet:null,f:{},ob:{step:0,zone:4,cq:''},zoneFilter:null,confirm:null,readonly:false}};
let downloads=null,roomCap=null;S.cnames={};
// C36: up to the server's MAX_CIRCLES circles (3 unless it says otherwise; 3 in demo mode). me.circle is the one on screen.
const maxCircles=()=>Math.max(1,+(S.hello&&S.hello.maxCircles)||3);
const myCircles=()=>{const m=S.me||{},cs=Array.isArray(m.circles)?m.circles.filter(Boolean):[];return m.circle&&!cs.includes(m.circle)?[m.circle,...cs]:cs};
try{const t=localStorage.getItem('insane_tab');if(t)S.ui.tab=t}catch(e){}
const F=S.ui.f;

/* ---------- subscriptions: one per group, swapped when the key changes ---------- */
const SUBS={};
function want(group,key,make,fn){
  if(SUBS[group]&&SUBS[group].key===key)return;drop(group);if(!key)return;
  // a late snapshot from a subscription that was swapped out (another circle) is dropped, never drawn
  const g=SUBS[group]={key,u:()=>{}};try{g.u=make().onSnapshot(x=>{if(SUBS[group]===g)fn(x)},e=>{console.warn('sub',group,e&&e.code);if(e&&e.code==='revoked')toast('Access to this app changed. Reload to continue.')})}catch(e){console.warn(group,e)}
}
function drop(group){if(SUBS[group]){SUBS[group].u();delete SUBS[group]}}
const docs=snap=>snap.docs.map(d=>Object.assign({id:d.id},d.data()));

function wire(){
  const db=S.db,uid=S.uid;
  want('me','me',()=>db.doc('people/'+uid),s=>{S.me=s.exists?s.data():null;wire2();render();if(S.deep&&S.me)setTimeout(handleDeep,400)});
  want('priv','priv',()=>db.collection('data/users/'+uid),s=>{const p={};for(const d of s.docs)p[d.id]=d.data();S.priv=p;wire2();render()});
  want('ev','ev',()=>db.doc('ev/'+uid),s=>{S.ev=s.exists?s.data():{first:{},days:[]};S.evLoaded=true;dailyVisit()});
}
function wire2(){
  const db=S.db,me=S.me,uid=S.uid;
  const cid=me&&me.circle,city=me&&me.city,wk=weekKey();
  if(cid!==S.cid){if(S.cid!==undefined&&S.ui.open&&S.ui.open.type!=='dm')S.ui.open=null;S.cid=cid;
    Object.assign(S,{circle:null,threads:[],members:[],progress:{},midnight:[],sealed:[],rooms:[],favors:[],dares:[],daily:{},clips:[],cheers:[],mole:null,moleLast:null,votes:[]})}
  for(const id of myCircles())if(!(id in S.cnames)){S.cnames[id]='';db.doc('circles/'+id).get().then(x=>{S.cnames[id]=x.exists&&x.data().name||'';render()}).catch(()=>{})}
  want('circle',cid,()=>db.doc('circles/'+cid),s=>{S.circle=s.exists?Object.assign({id:cid},s.data()):null;if(S.circle)S.cnames[cid]=S.circle.name;syncVerified();render()});
  want('threads',cid,()=>db.collection(`circles/${cid}/threads`),s=>{S.threads=docs(s);render()});
  want('progress',cid,()=>db.collection(`circles/${cid}/progress`),s=>{S.progress={};for(const d of s.docs)S.progress[d.id]=d.data();render()});
  want('members',cid,()=>db.collection('people').where('circles','array-contains',cid),s=>{S.members=docs(s);for(const m of S.members)S.people[m.id]=m;syncVerified();render()});
  want('midnight',cid,()=>db.collection(`circles/${cid}/midnight`),s=>{S.midnight=docs(s);render()});
  want('sealed',cid,()=>db.collection(`circles/${cid}/sealed`),s=>{S.sealed=docs(s);render()});
  want('rooms',cid,()=>db.collection('rooms').where('circles','array-contains',cid),s=>{S.rooms=docs(s);render()});
  want('solves',city&&city+wk,()=>db.collection('solves').where('week','==',wk).where('city','==',city),s=>{S.solves=docs(s).sort((a,b)=>a.at-b.at);render()});
  const ref=myRef(),gs=ref?nearCells(ref[0],ref[1],G):null;
  want('drops',gs&&gs.join(','),()=>db.collection('drops').where('g','in',gs),s=>{S.drops=docs(s);render()});
  want('checkins',city&&city+wk,()=>db.collection('checkins').where('city','==',city).where('week','==',wk),s=>{S.checkins=docs(s);render()});
  want('mych',me?'mych':null,()=>db.collection('checkins').where('uid','==',uid),s=>{S.myCheckins=docs(s).sort((a,b)=>b.at-a.at);render()});
  want('mysolves',me?'mysolves':null,()=>db.collection('solves').where('uid','==',uid),s=>{S.mySolves=docs(s);render()});
  want('posts',city,()=>db.collection('posts').where('city','==',city).orderBy('at','desc').limit(80),s=>{S.posts=docs(s);render()});
  want('calls',city,()=>db.collection('calls').where('city','==',city),s=>{S.calls=docs(s);render()});
  const lwk=weekKey(now()-7*DAY);
  want('favors',cid,()=>db.collection(`circles/${cid}/favors`),s=>{S.favors=docs(s);render()});
  want('dares',cid,()=>db.collection(`circles/${cid}/dares`),s=>{S.dares=docs(s);render()});
  want('daily',cid&&cid+today(),()=>db.doc(`circles/${cid}/daily/${today()}`),s=>{S.daily=s.exists?s.data():{};render()});
  want('clips',cid,()=>db.collection(`circles/${cid}/clips`),s=>{S.clips=docs(s);sweepClips();render()});
  want('cheers',cid&&cid+wk,()=>db.collection(`circles/${cid}/cheers`).where('week','==',wk),s=>{S.cheers=docs(s);render()});
  want('mole',cid&&cid+wk,()=>db.doc(`circles/${cid}/moles/${wk}`),s=>{S.mole=s.exists?s.data():null;render()});
  want('molelast',cid&&cid+lwk,()=>db.doc(`circles/${cid}/moles/${lwk}`),s=>{S.moleLast=s.exists?s.data():null;render()});
  want('votes',cid&&cid+wk,()=>db.collection(`circles/${cid}/molevotes`).where('week','in',[wk,lwk]),s=>{S.votes=docs(s);render()});
  want('missions',city,()=>db.collection('missions').where('city','==',city),s=>{S.missions=docs(s);render()});
  want('trails',city,()=>db.collection('trails').where('city','==',city),s=>{S.trails=docs(s);render()});
  want('stamps',city,()=>db.collection('stamps').where('city','==',city),s=>{S.stamps=docs(s);render()});
  want('live',S.backend==='server'&&cid?'live':null,()=>db.collection('live').where('on','==',true),s=>{S.live=s.docs.map(d=>d.id);render()});
  if(S.backend==='claude'&&roomCap&&cid&&S.roomFor!==cid){S.roomFor=cid;try{roomCap.presence({uid,circle:cid}).catch(()=>{});if(!S.roomSub)S.roomSub=roomCap.onPeers(ch=>{S.roomPeers=ch.peers.map(p=>p.presence&&p.presence.circle===S.me?.circle&&p.presence.uid).filter(Boolean);render()})}catch(e){}}
  want('met',me?'met':null,()=>db.collection('met').where('ids','array-contains',uid),s=>{const prev=new Set(S.met.map(m=>m.id));S.met=docs(s);
    for(const m of S.met){const o=m.ids.find(x=>x!==uid);person(o);if(S.metLoaded&&!prev.has(m.id))S.db.doc('people/'+o).get().then(ps=>{const nm=(ps.exists&&ps.data().name)||'someone';if(ps.exists)S.people[o]=ps.data();celebrate('MET','You met '+nm+'. You can message each other now.');logMine('Met '+nm+' in person');mark('met')}).catch(()=>{})}S.metLoaded=true;syncVerified();render()});
  const o=S.ui.open;
  want('msgs',o&&openPath(o),()=>db.collection(openPath(o)+'/msgs').orderBy('at','asc').limit(300),s=>{S.msgs=docs(s);render(true)});
  const sd=S.ui.sheet&&S.ui.sheet.t==='drop'?S.ui.sheet.id:null;
  want('dropIns',sd,()=>db.collection('checkins').where('drop','==',sd),s=>{S.dropIns=docs(s);render()});
}
// Two people in the same circle who have scanned each other's phones mark the circle as met in person.
function syncVerified(){const c=S.circle;if(!c||!S.me?.circle)return;const v=c.verified||{};const mem=new Set(S.members.map(m=>m.id));const add={};
  for(const m of S.met){const o=m.ids.find(x=>x!==S.uid);if(mem.has(o)){if(!v[S.uid])add[S.uid]=true;if(!v[o])add[o]=true}}
  if(Object.keys(add).length&&!syncVerified.busy){syncVerified.busy=1;S.db.doc('circles/'+c.id).update({verified:add}).catch(()=>{}).finally(()=>{syncVerified.busy=0})}}
function openPath(o){if(!o)return null;if(o.type==='thread')return `circles/${S.me&&S.me.circle}/threads/${o.id}`;if(o.type==='room')return 'rooms/'+o.id;if(o.type==='dm')return 'dms/'+o.id;return null}
const pending={};
function person(id){if(!id||S.people[id]||pending[id])return S.people[id];pending[id]=1;S.db.doc('people/'+id).get().then(s=>{S.people[id]=s.exists?s.data():{name:'Someone'};render()}).catch(()=>{});return null}
const nameOf=id=>id===S.uid?'You':(S.people[id]?.name||person(id)?.name||'Someone');

