/* ---------- the INSANE server: the same calls as the artifact's store, over HTTP and server-sent events ---------- */
function RemoteDB(){
  const cid=rnd(14),subs=new Map();let es=null;
  const call=(r,b)=>fetch('/api/'+r,{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',body:JSON.stringify(b)}).then(async x=>{const j=await x.json().catch(()=>({}));if(!x.ok)throw {code:j.code||'unavailable',message:j.message||String(x.status)};return j});
  const meta={fromCache:false,hasPendingWrites:false};
  const dsnap=(p,d)=>({id:p.split('/').pop(),exists:d!=null,data:()=>d==null?undefined:JSON.parse(JSON.stringify(d)),metadata:meta});
  const qsnap=(p,rows)=>{const docs=rows.map(r=>dsnap(p+'/'+r.id,r.data));return {docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:meta}};
  function stream(){if(es)return;es=new EventSource('/api/stream?cid='+cid);
    es.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(x){return}const s=subs.get(m.sub);if(!s)return;if(m.error){if(s.err)s.err({code:m.error});return}s.next(m)};
    es.onerror=()=>{if(!S.offline){S.offline=true;render()}};es.onopen=()=>{if(S.offline){S.offline=false;render()}}}
  function listen(spec,next,err){const id=rnd(10);subs.set(id,{spec,next,err});stream();call('sub',{cid,sub:id,spec}).catch(e=>err&&err(e));return()=>{subs.delete(id);call('unsub',{cid,sub:id}).catch(()=>{})}}
  function docRef(p){return {id:p.split('/').pop(),path:p,
    get:async()=>dsnap(p,(await call('get',{path:p})).doc),
    set:async d=>{await call('set',{path:p,data:d})},update:async d=>{await call('update',{path:p,data:d})},delete:async()=>{await call('delete',{path:p})},
    onSnapshot:(next,err)=>listen({doc:p},m=>next(dsnap(p,m.doc)),err),collection:c=>colRef(p+'/'+c)}}
  function query(p,fl,ord,lim){const spec={col:p,where:fl,orderBy:ord,limit:lim||0};
    return {where:(f,op,v)=>query(p,[...fl,[f,op,v]],ord,lim),orderBy:(f,d)=>query(p,fl,[f,d||'asc'],lim),limit:n=>query(p,fl,ord,n),
      get:async()=>qsnap(p,(await call('query',spec)).docs),onSnapshot:(next,err)=>listen(spec,m=>next(qsnap(p,m.docs)),err)}}
  function colRef(p){return Object.assign(query(p,[],null,0),{path:p,doc:id=>docRef(p+'/'+(id||rnd(16))),add:async d=>{const r=docRef(p+'/'+rnd(16));await r.set(d);return r}})}
  return {doc:docRef,collection:colRef,call};
}
// Door codes are stored only as a slow hash, so the code can't be read out of the store while the drop is on.
async function codeHash(code,salt){const enc=new TextEncoder();const k=await crypto.subtle.importKey('raw',enc.encode(String(code).toUpperCase()),'PBKDF2',false,['deriveBits']);const b=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode('insane-door|'+salt),iterations:150000},k,128);return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}

function localUid(){
  const m=/[?&]as=([a-z0-9_-]+)/i.exec(location.search);if(m)return 'local_'+m[1];
  try{let u=localStorage.getItem('insane_uid');if(!u){u='local_'+rnd(10);localStorage.setItem('insane_uid',u)}return u}catch(e){return 'local_guest'}
}

