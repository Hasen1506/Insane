/* ---------- content: the server's lists in server mode, and picks that don't repeat ---------- */
// The page carries the seed lists (34-packs.js). In server mode the owner may have added or edited dares
// and Mole tasks (/admin/content), so the live lists replace them once fetched. Mole tasks keep their
// permanent index, so a Mole's private task list means the same thing before and after.
const CONTENT={live:null,busy:false};
function contentLoad(){if(S.backend!=='server'||CONTENT.live||CONTENT.busy)return;CONTENT.busy=true;
  fetch('/api/content',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(j=>{if(!j)return;CONTENT.live=j;
    if(Array.isArray(j.dares)&&j.dares.length){STARTER_DARES.length=0;for(const d of j.dares)STARTER_DARES.push([d.text,d.level])}
    if(Array.isArray(j.mole)&&j.mole.length){MOLE_POOL.length=0;for(const m of j.mole){MOLE_TASKS[m.i]=m.text;MOLE_N[m.i]=m.n;MOLE_POOL.push(m.i)}}
    render()}).catch(()=>{}).finally(()=>{CONTENT.busy=false})}
// Three Mole tasks you haven't had yet (your own history, kept private), until you've had them all.
// Random, not scheduled, so nobody in the circle can work out the Mole's tasks.
function moleDraw(){const r=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296;return pickFresh(MOLE_POOL,(S.priv.molehist&&S.priv.molehist.used)||[],3,r)}
