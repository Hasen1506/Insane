/* ---------- local store: demo on one device, and the test harness ---------- */
function LocalDB(){
  const KEY='insane_local_db';let mem={};
  const load=()=>{try{mem=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){mem=mem||{}}};load();
  const subs=new Set();let bc=null;try{bc=new BroadcastChannel('insane_local')}catch(e){}
  const fire=()=>{for(const f of [...subs])f()};
  if(bc)bc.onmessage=()=>{load();fire()};
  addEventListener('storage',e=>{if(e.key===KEY){load();fire()}});
  const changed=()=>{try{localStorage.setItem(KEY,JSON.stringify(mem))}catch(e){}if(bc)bc.postMessage(1);setTimeout(fire,0)};
  const clone=o=>JSON.parse(JSON.stringify(o));
  const snap=p=>{const d=mem[p];return {id:p.split('/').pop(),exists:!!d,data:()=>d?clone(d):undefined,metadata:{fromCache:false,hasPendingWrites:false}}};
  const merge=(a,b)=>{for(const k in b){const v=b[k];if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);else a[k]=v}return a};
  const test=(x,op,v)=>({'==':x===v,'!=':x!==v,'<':x<v,'<=':x<=v,'>':x>v,'>=':x>=v,'in':Array.isArray(v)&&v.includes(x),'not-in':Array.isArray(v)&&!v.includes(x),'array-contains':Array.isArray(x)&&x.includes(v)})[op];
  function docRef(p){return {id:p.split('/').pop(),path:p,get:async()=>snap(p),
    set:async d=>{mem[p]=clone(d);changed()},
    update:async d=>{if(!mem[p])throw {code:'invalid_argument',message:'Document does not exist'};merge(mem[p],clone(d));changed()},
    delete:async()=>{delete mem[p];changed()},
    onSnapshot(next){let last=null;const f=()=>{const j=JSON.stringify(mem[p]??null);if(j!==last){last=j;next(snap(p))}};subs.add(f);setTimeout(f,0);return()=>subs.delete(f)},
    collection:c=>colRef(p+'/'+c)}}
  function query(p,fl,ord,lim){
    const run=()=>{const segs=p.split('/').length+1;let docs=Object.keys(mem).filter(k=>k.startsWith(p+'/')&&k.split('/').length===segs).map(snap);
      for(const [f,op,v] of fl)docs=docs.filter(s=>test(s.data()[f],op,v));
      if(ord){const [f,dir]=ord;docs.sort((a,b)=>{const x=a.data()[f],y=b.data()[f];if(x===undefined)return 1;if(y===undefined)return -1;return (x<y?-1:x>y?1:0)*(dir==='desc'?-1:1)})}else docs.sort((a,b)=>a.id<b.id?-1:1);
      if(lim)docs=docs.slice(0,lim);return {docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false,hasPendingWrites:false}}};
    return {where:(f,op,v)=>query(p,[...fl,[f,op,v]],ord,lim),orderBy:(f,d)=>query(p,fl,[f,d||'asc'],lim),limit:n=>query(p,fl,ord,n),get:async()=>run(),
      onSnapshot(next){let last=null;const f=()=>{const r=run();const j=JSON.stringify(r.docs.map(d=>[d.id,d.data()]));if(j!==last){last=j;next(r)}};subs.add(f);setTimeout(f,0);return()=>subs.delete(f)}}}
  function colRef(p){return Object.assign(query(p,[],null,0),{path:p,doc:id=>docRef(p+'/'+(id||rnd(16))),add:async d=>{const r=docRef(p+'/'+rnd(16));await r.set(d);return r}})}
  return {doc:docRef,collection:colRef};
}
