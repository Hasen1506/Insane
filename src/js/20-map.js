/* ---------- the map: a configurable street basemap where one is set up, otherwise the bundled world map ----------
   Basemap sources (C69), set by the server's /api/hello (TILE_URL, TILE_KIND, TILE_ATTR, TILE_URL_DARK, TILE_MAXZ):
     none     the bundled world map only (Natural Earth + GeoNames, served with the app): no third party sees anyone
     pmtiles  a Protomaps vector basemap read by byte range from one .pmtiles file (self-hosted, offline-friendly)
     xyz      any raster tile template, for a hosted provider (Stadia, MapTiler…) with its own key and terms
   tile.openstreetmap.org is never the default (its usage policy forbids this). If the street basemap fails, is
   slow or the phone is offline, the map falls back to the bundled one and says so (C49).
   Painting (WS0 found the per-frame pulse starving the CPU): the basemap is drawn once into a cached layer and only
   redrawn when the view or the data changes; markers are drawn over it. Nothing paints while the map is off
   screen or the tab is hidden, and the open-drop pulse runs at ~12 fps only while visible, never with reduced motion. */
const MAPCFG={kind:'none',tiles:'',dark:'',attr:'',maxZ:19,tilesOk:null};
function setTiles(h){h=h||{};const u=h.tiles&&h.tiles!=='none'?String(h.tiles):'';MAPCFG.kind=u?(h.tileKind||(/\.pmtiles(\?|$)/.test(u)?'pmtiles':'xyz')):'none';MAPCFG.tiles=u;MAPCFG.dark=h.tileDark||'';MAPCFG.attr=h.attr||'';MAPCFG.maxZ=+h.tileMaxZ||(MAPCFG.kind==='pmtiles'?15:19);MAPCFG.tilesOk=null;MAPCFG.t0=0;PM.url='';PM.p=null;MAPGEN++;Object.values(MAPS).forEach(m=>m.redraw())}
let MAPGEN=0; // bumps whenever anything a basemap is drawn from arrives
const bumpMaps=()=>{MAPGEN++;Object.values(MAPS).forEach(m=>m.redraw())};
const VT={world:null,tiles:new Map(),loadingWorld:null};
function mUnit(lat,lon){const s=Math.sin(rad(Math.max(-85,Math.min(85,lat))));return [(lon+180)/360,.5-Math.log((1+s)/(1-s))/(4*Math.PI)]}
function mInv(x,y){const n=Math.PI-2*Math.PI*y;return [180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n))),x*360-180]}
function decodeLine(a,q){const out=new Float64Array(a.length);let x=0,y=0;for(let i=0;i<a.length;i+=2){x+=a[i];y+=a[i+1];const u=mUnit(y/q,x/q);out[i]=u[0];out[i+1]=u[1]}return out}
function loadWorld(){if(VT.loadingWorld)return VT.loadingWorld;VT.loadingWorld=fetch('data/world.json').then(r=>r.json()).then(w=>{VT.world={land:w.land.map(p=>p.map(r=>decodeLine(r,100))),lake:w.lake.map(p=>p.map(r=>decodeLine(r,100))),b0:w.b0.map(l=>decodeLine(l,100))};bumpMaps()}).catch(()=>{VT.world={land:[],lake:[],b0:[]}});return VT.loadingWorld}
function loadVT(k){if(VT.tiles.has(k))return VT.tiles.get(k);VT.tiles.set(k,null);fetch('data/t/'+k+'.json').then(r=>r.ok?r.json():{}).then(t=>{const d={};for(const L of ['land','lake','urban'])d[L]=(t[L]||[]).map(p=>p.map(r=>decodeLine(r,1e4)));for(const L of ['b0','b1','road','river'])d[L]=(t[L]||[]).map(([c,l])=>[c,decodeLine(l,1e4)]);VT.tiles.set(k,d);bumpMaps()}).catch(()=>VT.tiles.set(k,{}));return null}

/* ---------- PMTiles v3 (byte-range reads) and Mapbox Vector Tiles, no libraries ---------- */
const PM={url:'',p:null,hdr:null,root:null,dirs:new Map(),tiles:new Map(),busy:0};
function pbfVarint(b,o){let r=0,s=1,x;do{x=b[o.p++];r+=(x&127)*s;s*=128}while(x&128);return r}
async function gunzip(buf){if(typeof DecompressionStream==='undefined')throw new Error('no gzip');return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()}
async function pmRange(off,len){const r=await fetch(PM.url,{headers:{Range:`bytes=${off}-${off+len-1}`}});if(r.status!==206&&r.status!==200)throw new Error('tiles '+r.status);const b=await r.arrayBuffer();return r.status===200&&b.byteLength>len?b.slice(off,off+len):b}
function pmDir(buf){const b=new Uint8Array(buf),o={p:0};const n=pbfVarint(b,o),E=[];let last=0;
  for(let i=0;i<n;i++){last+=pbfVarint(b,o);E.push({id:last,rl:0,len:0,off:0})}
  for(let i=0;i<n;i++)E[i].rl=pbfVarint(b,o);for(let i=0;i<n;i++)E[i].len=pbfVarint(b,o);
  for(let i=0;i<n;i++){const v=pbfVarint(b,o);E[i].off=v===0&&i>0?E[i-1].off+E[i-1].len:v-1}return E}
// A tile's id: every tile above its zoom, then its place on the Hilbert curve at its zoom (PMTiles v3).
function pmTileId(z,x,y){let acc=0;for(let i=0;i<z;i++)acc+=4**i;const n=2**z;let d=0;
  for(let s=n/2;s>=1;s/=2){const rx=(x&s)>0?1:0,ry=(y&s)>0?1:0;d+=s*s*((3*rx)^ry);if(ry===0){if(rx===1){x=n-1-x;y=n-1-y}const t=x;x=y;y=t}}return acc+d}
function pmFind(E,id){let lo=0,hi=E.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(E[m].id<id)lo=m+1;else if(E[m].id>id)hi=m-1;else return E[m]}
  if(hi>=0){const e=E[hi];if(e.rl===0||id-e.id<e.rl)return e}return null}
function pmOpen(){if(PM.p&&PM.url===MAPCFG.tiles)return PM.p;PM.url=MAPCFG.tiles;PM.dirs.clear();PM.tiles.clear();
  PM.p=pmRange(0,16384).then(async buf=>{const v=new DataView(buf);if(String.fromCharCode(...new Uint8Array(buf,0,7))!=='PMTiles'||v.getUint8(7)!==3)throw new Error('not pmtiles v3');
    const u=o=>Number(v.getBigUint64(o,true));const h={rootOff:u(8),rootLen:u(16),leafOff:u(40),tileOff:u(56),ic:v.getUint8(97),tc:v.getUint8(98),type:v.getUint8(99),minZ:v.getUint8(100),maxZ:v.getUint8(101),bb:[v.getInt32(106,true)/1e7,v.getInt32(102,true)/1e7,v.getInt32(114,true)/1e7,v.getInt32(110,true)/1e7]};
    if(h.type!==1)throw new Error('only vector (MVT) pmtiles');PM.hdr=h;let root=buf.slice(h.rootOff,h.rootOff+h.rootLen);if(h.ic===2)root=await gunzip(root);PM.root=pmDir(root);return h});
  return PM.p}
async function pmGet(z,x,y){const h=await pmOpen();if(z<h.minZ||z>h.maxZ)return null;const id=pmTileId(z,x,y);let E=PM.root;
  for(let depth=0;depth<4;depth++){const e=pmFind(E,id);if(!e)return null;
    if(e.rl>0){let b=await pmRange(h.tileOff+e.off,e.len);if(h.tc===2)b=await gunzip(b);return b}
    const k=e.off+':'+e.len;if(!PM.dirs.has(k)){PM.dirs.set(k,pmRange(h.leafOff+e.off,e.len).then(async b=>pmDir(h.ic===2?await gunzip(b):b)));if(PM.dirs.size>64)PM.dirs.delete(PM.dirs.keys().next().value)}E=await PM.dirs.get(k)}
  return null}
const MVT_KEEP=new Set(['earth','water','landuse','landcover','roads','boundaries','places','buildings']);
const MVT_TAGS=new Set(['kind','name','min_zoom','kind_detail']);
// Decodes only the layers and tags the map draws: { layer: [{type, tags, geom: [[x,y,x,y…],…]}] } in tile units.
function mvtDecode(buf){const b=new Uint8Array(buf),o={p:0},out={};
  const skip=w=>{if(w===0)pbfVarint(b,o);else if(w===1)o.p+=8;else if(w===2){const l=pbfVarint(b,o);o.p+=l}else if(w===5)o.p+=4};
  const str=end=>new TextDecoder().decode(b.subarray(o.p,o.p=end));
  while(o.p<b.length){const t=pbfVarint(b,o);if(t>>3!==3||(t&7)!==2){skip(t&7);continue}const len=pbfVarint(b,o),end=o.p+len;
    let name='',ext=4096;const keys=[],vals=[],feats=[];
    while(o.p<end){const u=pbfVarint(b,o),f=u>>3,w=u&7;
      if(f===1&&w===2){const l=pbfVarint(b,o);name=str(o.p+l);if(!MVT_KEEP.has(name)){o.p=end;break}}
      else if(f===2&&w===2){const l=pbfVarint(b,o);feats.push([o.p,o.p+l]);o.p+=l}
      else if(f===3&&w===2){const l=pbfVarint(b,o);keys.push(str(o.p+l))}
      else if(f===4&&w===2){const l=pbfVarint(b,o),ve=o.p+l;let v=null;while(o.p<ve){const q=pbfVarint(b,o),vf=q>>3,vw=q&7;
          if(vf===1){const sl=pbfVarint(b,o);v=str(o.p+sl)}else if(vf===2){v=new DataView(b.buffer,b.byteOffset+o.p,4).getFloat32(0,true);o.p+=4}else if(vf===3){v=new DataView(b.buffer,b.byteOffset+o.p,8).getFloat64(0,true);o.p+=8}
          else if(vf===4||vf===5){v=pbfVarint(b,o)}else if(vf===6){const z=pbfVarint(b,o);v=z%2?-(z+1)/2:z/2}else if(vf===7){v=!!pbfVarint(b,o)}else skip(vw)}vals.push(v)}
      else if(f===5&&w===0)ext=pbfVarint(b,o);else skip(w)}
    o.p=end;if(!MVT_KEEP.has(name))continue;
    const L=out[name]=[];const sc=1/ext;
    for(const [a,e] of feats){const q={p:a};let type=0,tags={},geom=[];
      while(q.p<e){const u=pbfVarint(b,q),f=u>>3,w=u&7;
        if(f===2&&w===2){const l=pbfVarint(b,q),te=q.p+l;while(q.p<te){const k=keys[pbfVarint(b,q)],v=vals[pbfVarint(b,q)];if(MVT_TAGS.has(k))tags[k]=v}}
        else if(f===3&&w===0)type=pbfVarint(b,q);
        else if(f===4&&w===2){const l=pbfVarint(b,q),ge=q.p+l;let x=0,y=0,cur=null;
          while(q.p<ge){const c=pbfVarint(b,q),id=c&7,n=c>>3;
            if(id===1||id===2){for(let i=0;i<n;i++){const dx=pbfVarint(b,q),dy=pbfVarint(b,q);x+=dx%2?-(dx+1)/2:dx/2;y+=dy%2?-(dy+1)/2:dy/2;if(id===1){cur=[];geom.push(cur)}cur.push(x*sc,y*sc)}}
            else if(id===7&&cur){cur.push(cur[0],cur[1])}}}
        else{const sk=w;if(sk===0)pbfVarint(b,q);else if(sk===2){const l=pbfVarint(b,q);q.p+=l}else if(sk===1)q.p+=8;else q.p+=4}}
      L.push({type,tags,geom})}}
  return out}
const RK={highway:0,major_road:1,medium_road:1,minor_road:2,other:3,path:4};
// One vector tile drawn once into a canvas at its own zoom (theme-coloured), plus its place labels for the label pass.
function pmTileCanvas(z,x,y,col,th){const k=z+'/'+x+'/'+y+'|'+th;const hit=PM.tiles.get(k);if(hit!==undefined)return hit;PM.tiles.set(k,null);
  pmGet(z,x,y).then(buf=>{if(!buf){PM.tiles.set(k,false);bumpMaps();return}const L=mvtDecode(buf);const T=512;const cv=document.createElement('canvas');cv.width=cv.height=T;const g=cv.getContext('2d');
    const path=(geom,close)=>{for(const r of geom){g.moveTo(r[0]*T,r[1]*T);for(let i=2;i<r.length;i+=2)g.lineTo(r[i]*T,r[i+1]*T);if(close)g.closePath()}};
    const fill=(fs,c)=>{g.beginPath();for(const f of fs)if(f.type===3)path(f.geom,true);g.fillStyle=c;g.fill('evenodd')};
    g.fillStyle=col.sea;g.fillRect(0,0,T,T);
    fill(L.earth||[],col.land);
    const lu=[...(L.landuse||[]),...(L.landcover||[])];
    fill(lu.filter(f=>/park|garden|forest|wood|grass|meadow|cemetery|golf|nature|recreation|pitch|farmland/.test(f.tags.kind||'')),col.park);
    fill(lu.filter(f=>/residential|commercial|industrial|retail|urban|hospital|school|university|railway|military/.test(f.tags.kind||'')),col.urban);
    fill(L.water||[],col.sea);
    if(z>=14)fill(L.buildings||[],col.bld);
    const roads=(L.roads||[]).filter(f=>f.type===2);const zw=Math.max(.6,(z-10)*.38);
    for(const [rk,c,w] of [[4,col.line,.5],[3,col.line,.9],[2,col.line,1.3],[1,col.muted,1.6],[0,col.road,2.2]]){const fs=roads.filter(f=>(RK[f.tags.kind]??3)===rk);if(!fs.length||(rk===4&&z<15)||(rk===3&&z<13))continue;g.beginPath();for(const f of fs)path(f.geom,false);g.strokeStyle=c;g.lineWidth=w*zw;g.lineCap='round';g.lineJoin='round';g.stroke()}
    g.beginPath();for(const f of L.boundaries||[])path(f.geom,false);g.setLineDash([6,4]);g.strokeStyle=col.muted;g.lineWidth=1.2;g.stroke();g.setLineDash([]);
    const labels=[];for(const f of L.places||[]){if(f.type!==1||!f.tags.name||(f.tags.min_zoom||0)>z+.5)continue;const r=f.geom[0];const rank=f.tags.kind==='country'?0:f.tags.kind==='region'?1:f.tags.kind==='locality'?2:3;labels.push({u:[(x+r[0])/2**z,(y+r[1])/2**z],n:String(f.tags.name),rank})}
    PM.tiles.set(k,{cv,labels});if(PM.tiles.size>160)PM.tiles.delete(PM.tiles.keys().next().value);MAPCFG.tilesOk=true;bumpMaps()}).catch(()=>{PM.tiles.set(k,false);if(!MAPCFG.tilesOk){MAPCFG.tilesOk=false}bumpMaps()});
  return null}

/* ---------- clustering: points closer than r px merge into one bubble; every point is in exactly one cluster ---------- */
function clusterPx(pts,r){const order=pts.map((p,i)=>i).sort((a,b)=>pts[a][0]-pts[b][0]||pts[a][1]-pts[b][1]||a-b);const used=new Uint8Array(pts.length),out=[];
  for(const i of order){if(used[i])continue;used[i]=1;const m=[i];let sx=pts[i][0],sy=pts[i][1];
    for(const j of order){if(used[j])continue;if(Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1])<r){used[j]=1;m.push(j);sx+=pts[j][0];sy+=pts[j][1]}}
    out.push({x:sx/m.length,y:sy/m.length,members:m})}return out}
const reducedMotion=()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(e){return false}};
const MAPS={};
class MapView{
  constructor(key){this.key=key;this.el=document.createElement('div');this.el.className='mapv';this.cv=document.createElement('canvas');this.cv.setAttribute('role','img');this.el.appendChild(this.cv);
    this.el.insertAdjacentHTML('beforeend',`<div class="mapctl"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="-1" aria-label="Zoom out">−</button><button type="button" data-z="0" aria-label="Recenter the map">◎</button><button type="button" data-z="full" aria-label="Full-screen map" aria-pressed="false">⤢</button></div><div class="mapnote" role="status" hidden></div><div class="maphint" aria-hidden="true" hidden>Use two fingers to move the map, or ⤢ for full screen</div><div class="mapattr"></div>`);
    this.center=[20,0];this.z=2;this.img=new Map();this.ptr=new Map();this.spec={};this.w=300;this.h=240;this.q=0;this.vis=true;this.dirty=false;this.base=null;this.baseKey='';this.labels=[];
    this.el.querySelectorAll('.mapctl button').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const z=b.dataset.z;if(z==='full')this.full(!this.el.classList.contains('full'));else if(+z)this.zoomBy(+z,this.w/2,this.h/2);else this.recenter()}));
    const cv=this.cv;this.touch();
    cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);this.ptr.set(e.pointerId,[e.offsetX,e.offsetY]);this.moved=0;this.pinch=null;this.t0=Date.now()});
    cv.addEventListener('pointermove',e=>{const p=this.ptr.get(e.pointerId);if(!p)return;const nx=e.offsetX,ny=e.offsetY;
      if(this.ptr.size===1){const dx=nx-p[0],dy=ny-p[1];this.moved+=Math.abs(dx)+Math.abs(dy);this.panBy(-dx,-dy)}
      else if(this.ptr.size===2){const [a,b]=[...this.ptr.values()];const d0=Math.hypot(a[0]-b[0],a[1]-b[1]),m0=[(a[0]+b[0])/2,(a[1]+b[1])/2];this.ptr.set(e.pointerId,[nx,ny]);const [c,d]=[...this.ptr.values()];const d1=Math.hypot(c[0]-d[0],c[1]-d[1]),m1=[(c[0]+d[0])/2,(c[1]+d[1])/2];this.panBy(m0[0]-m1[0],m0[1]-m1[1]);if(d0>0)this.zoomBy(Math.log2(d1/d0),m1[0],m1[1]);this.moved+=99;return}
      this.ptr.set(e.pointerId,[nx,ny])});
    const up=e=>{if(!this.ptr.has(e.pointerId))return;this.ptr.delete(e.pointerId);if(this.moved<8&&Date.now()-this.t0<600&&this.ptr.size===0)this.tap(e.offsetX,e.offsetY)};
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',e=>{this.ptr.delete(e.pointerId);if(e.pointerType==='touch'&&this.coop&&!this.el.classList.contains('full'))this.hint()});
    cv.addEventListener('wheel',e=>{if(this.coop&&!this.el.classList.contains('full')&&!e.ctrlKey&&!e.metaKey)return;e.preventDefault();this.zoomBy(-e.deltaY/(e.deltaMode?3:240),e.offsetX,e.offsetY)},{passive:false});
    cv.addEventListener('dblclick',e=>{e.preventDefault();this.zoomBy(1,e.offsetX,e.offsetY)});
    new ResizeObserver(()=>{this.baseKey='';this.redraw()}).observe(this.el);
    if(typeof IntersectionObserver!=='undefined')new IntersectionObserver(es=>{for(const x of es){this.vis=x.isIntersecting;if(this.vis&&this.dirty)this.redraw()}}).observe(this.el);
  }
  // A map inside a scrolling page lets one finger scroll the page past it; two fingers (or full screen) move it.
  touch(){const full=this.el.classList.contains('full');this.cv.style.touchAction=this.coop&&!full?'pan-y':'none'}
  hint(){const h=this.el.querySelector('.maphint');h.hidden=false;clearTimeout(this.ht);this.ht=setTimeout(()=>{h.hidden=true},1600)}
  full(on){this.el.classList.toggle('full',on);this.el.querySelector('[data-z="full"]').setAttribute('aria-pressed',on);this.el.querySelector('[data-z="full"]').setAttribute('aria-label',on?'Close full-screen map':'Full-screen map');
    document.body.classList.toggle('mapfull',on);this.touch();if(on){this.esc=e=>{if(e.key==='Escape'){e.stopPropagation();this.full(false)}};addEventListener('keydown',this.esc,true)}else if(this.esc){removeEventListener('keydown',this.esc,true);this.esc=null}this.baseKey='';this.redraw()}
  recenter(){if(this.spec.home){this.center=this.spec.home.slice();this.z=this.spec.zoom||13;this.redraw()}}
  set(spec){const first=!this.spec.home;const moved=spec.home&&(!this.spec.home||spec.home[0]!==this.spec.home[0]||spec.home[1]!==this.spec.home[1]||(spec.zoom!=null&&spec.zoom!==this.spec.zoom&&spec.v!==this.spec.v));this.spec=spec;this.coop=!!spec.coop;this.touch();if(first||(moved&&spec.follow)){this.center=spec.home?spec.home.slice():[20,0];this.z=spec.zoom??(spec.home?13:2)}this.cv.setAttribute('aria-label',spec.label||'Map');
    // every app render re-sets each map's spec; repaint only if what it draws actually changed
    const sig=JSON.stringify([this.center,this.z,spec.v,(spec.items?spec.items():[]).map(i=>[i.type,i.ll,i.b,i.km,i.text,i.hot,i.label,i.style,i.m,i.pts&&i.pts.length])]);if(sig===this.sig&&!first&&!moved)return;this.sig=sig;this.redraw()}
  S(){return 256*2**this.z}
  toPx(lat,lon){const S=this.S(),c=mUnit(...this.center),u=mUnit(lat,lon);return [(u[0]-c[0])*S+this.w/2,(u[1]-c[1])*S+this.h/2]}
  fromPx(x,y){const S=this.S(),c=mUnit(...this.center);return mInv(c[0]+(x-this.w/2)/S,c[1]+(y-this.h/2)/S)}
  panBy(dx,dy){const S=this.S(),c=mUnit(...this.center);let ux=c[0]+dx/S,uy=Math.max(.02,Math.min(.98,c[1]+dy/S));ux=((ux%1)+1)%1;this.center=mInv(ux,uy);this.redraw()}
  zoomBy(dz,px,py){const before=this.fromPx(px,py);this.z=Math.max(1.5,Math.min(this.maxZ(),this.z+dz));const after=this.toPx(...before);this.panBy(after[0]-px,after[1]-py)}
  maxZ(){return MAPCFG.kind!=='none'&&MAPCFG.tilesOk!==false?Math.max(17,MAPCFG.maxZ+2):16}
  tap(x,y){const near=(a,b)=>Math.hypot(a[0]-x,a[1]-y);
    const cl=(this.clusters||[]).filter(c=>c.members.length>1&&Math.hypot(c.x-x,c.y-y)<24).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];
    if(cl){this.zoomBy(Math.min(3,Math.max(1.5,this.maxZ()-this.z)),cl.x,cl.y);return}
    const hit=(this.items||[]).filter(i=>i.pick&&i._px&&near(i._px)<22).sort((a,b)=>near(a._px)-near(b._px))[0];
    if(hit&&this.spec.onPick)this.spec.onPick(hit);else if(this.spec.onTap)this.spec.onTap(this.fromPx(x,y),this)}
  redraw(){if(!this.vis||(typeof document!=='undefined'&&document.hidden)){this.dirty=true;return}if(this.q)return;this.q=requestAnimationFrame(()=>{this.q=0;this.dirty=false;this.paint()})}
  colors(){const css=getComputedStyle(document.documentElement);const C=k=>css.getPropertyValue(k).trim();const dk=dark();
    return {sea:C('--sea'),land:C('--card'),urban:C('--cell2'),road:C('--muted'),line:C('--line'),ink:C('--ink'),muted:C('--muted'),stamp:C('--stamp'),ball:C('--ball'),good:C('--good'),paper:C('--paper'),park:dk?'rgba(80,170,120,.16)':'rgba(31,122,77,.12)',bld:dk?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)'}}
  paint(){
    const r=this.el.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(2,devicePixelRatio||1);this.w=r.width;this.h=r.height;
    const W=Math.round(this.w*dpr),H=Math.round(this.h*dpr);if(this.cv.width!==W||this.cv.height!==H){this.cv.width=W;this.cv.height=H}
    const col=this.colors();const th=dark()?'d':'l';
    const off=typeof navigator!=='undefined'&&navigator.onLine===false;
    const street=MAPCFG.kind!=='none'&&MAPCFG.tiles&&MAPCFG.tilesOk!==false&&!off;
    const key=[this.center[0].toFixed(7),this.center[1].toFixed(7),this.z.toFixed(4),W,H,th,MAPGEN,street,MAPCFG.tilesOk].join('|');
    if(key!==this.baseKey){if(!this.base)this.base=document.createElement('canvas');if(this.base.width!==W||this.base.height!==H){this.base.width=W;this.base.height=H}
      const b=this.base.getContext('2d');b.setTransform(dpr,0,0,dpr,0,0);this.labels=[];
      if(street){if(MAPCFG.kind==='pmtiles')this.paintPM(b,col,th);else this.paintTiles(b,col)}else this.paintVector(b,col);
      this.paintLabels(b,col);this.baseKey=key}
    const g=this.cv.getContext('2d');g.setTransform(1,0,0,1,0,0);g.drawImage(this.base,0,0);g.setTransform(dpr,0,0,dpr,0,0);
    this.paintItems(g,col);
    // what the basemap is, and an honest line when the street map isn't there (C49, C69)
    const failed=MAPCFG.kind!=='none'&&(MAPCFG.tilesOk===false||off);
    const at=street&&MAPCFG.tilesOk?esc(MAPCFG.attr):this.z>=11?`Natural Earth · GeoNames · <a href="${osmLink(this.center[0],this.center[1],Math.round(this.z))}" target="_blank" rel="noopener">streets on OpenStreetMap ↗</a>`:'Natural Earth · GeoNames';const ae=this.el.querySelector('.mapattr');if(ae.innerHTML!==at)ae.innerHTML=at;
    const ne=this.el.querySelector('.mapnote');const nt=failed?(off?'Offline: showing the outline map':'Street map unavailable: showing the outline map'):'';if(ne.textContent!==nt){ne.textContent=nt;ne.hidden=!nt}
  }
  // the street basemap hasn't answered in 8 s: stop waiting and draw the bundled map (a hanging host, a captive portal)
  waitTiles(){if(MAPCFG.tilesOk===null&&!MAPCFG.t0){MAPCFG.t0=Date.now();setTimeout(()=>{if(MAPCFG.tilesOk===null){MAPCFG.tilesOk=false;bumpMaps()}},8000)}}
  tileRange(zi){const n=2**zi,sc=this.S()/(256*n),ts=256*sc;const c=mUnit(...this.center);const ox=c[0]*n*256*sc-this.w/2,oy=c[1]*n*256*sc-this.h/2;
    return {n,ts,ox,oy,x0:Math.floor(ox/ts),x1:Math.floor((ox+this.w)/ts),y0:Math.max(0,Math.floor(oy/ts)),y1:Math.min(n-1,Math.floor((oy+this.h)/ts))}}
  paintPM(g,col,th){this.waitTiles();const h=PM.hdr;const mz=h?h.maxZ:MAPCFG.maxZ,minz=h?h.minZ:0;
    const zi=Math.max(0,Math.min(mz,Math.round(this.z)));const R=this.tileRange(zi);let missing=zi<minz;const draw=[];
    if(!missing)for(let x=R.x0;x<=R.x1;x++)for(let y=R.y0;y<=R.y1;y++){const xx=((x%R.n)+R.n)%R.n;const t=pmTileCanvas(zi,xx,y,col,th);if(t)draw.push([t,x*R.ts-R.ox,y*R.ts-R.oy]);else missing=true}
    if(missing)this.paintVector(g,col);else{g.fillStyle=col.sea;g.fillRect(0,0,this.w,this.h)}
    for(const [t,px,py] of draw){g.drawImage(t.cv,px,py,R.ts+.5,R.ts+.5);for(const l of t.labels)this.labels.push(l)}}
  paintTiles(g,col){this.waitTiles();
    const zi=Math.max(0,Math.min(MAPCFG.maxZ,Math.round(this.z)));const R=this.tileRange(zi);let missing=false;const draw=[];const url=dark()&&MAPCFG.dark?MAPCFG.dark:MAPCFG.tiles;
    for(let x=R.x0;x<=R.x1;x++)for(let y=R.y0;y<=R.y1;y++){const xx=((x%R.n)+R.n)%R.n,k=url+'|'+zi+'/'+xx+'/'+y;let im=this.img.get(k);
      if(!im){im=new Image();im.crossOrigin='anonymous';im.onload=()=>{MAPCFG.tilesOk=true;bumpMaps()};im.onerror=()=>{im.bad=1;if(!MAPCFG.tilesOk)MAPCFG.tilesOk=false;bumpMaps()};im.src=url.replace('{z}',zi).replace('{x}',xx).replace('{y}',y).replace('{r}',devicePixelRatio>1?'@2x':'');this.img.set(k,im);if(this.img.size>400)this.img.delete(this.img.keys().next().value)}
      if(im.complete&&im.naturalWidth)draw.push([im,x*R.ts-R.ox,y*R.ts-R.oy]);else missing=true}
    // a blank or failed tile shows the bundled map underneath, never a grey hole (C49)
    if(missing)this.paintVector(g,col);else{g.fillStyle=col.sea;g.fillRect(0,0,this.w,this.h)}
    const inv=dark()&&!MAPCFG.dark;for(const [im,px,py] of draw){if(inv)g.filter='invert(1) hue-rotate(180deg) brightness(.85) contrast(.9)';g.drawImage(im,px,py,R.ts+.5,R.ts+.5);g.filter='none'}}
  paintVector(g,col){
    g.fillStyle=col.sea;g.fillRect(0,0,this.w,this.h);
    const S=this.S(),c=mUnit(...this.center),ox=c[0]*S-this.w/2,oy=c[1]*S-this.h/2;
    const path=(arr,close)=>{for(let k=-1;k<=1;k++){const sh=k*S;if(sh-ox>this.w||sh-ox+S<0)continue;g.moveTo(arr[0]*S-ox+sh,arr[1]*S-oy);for(let i=2;i<arr.length;i+=2)g.lineTo(arr[i]*S-ox+sh,arr[i+1]*S-oy);if(close)g.closePath()}};
    const polys=(list,fill)=>{g.beginPath();for(const p of list)for(const r of p)path(r,true);g.fillStyle=fill;g.fill('evenodd')};
    const lines=(list,stroke,wd,dash,filt)=>{g.beginPath();for(const it of list){if(filt&&!filt(it[0]))continue;path(it[1]||it,false)}g.strokeStyle=stroke;g.lineWidth=wd;g.setLineDash(dash||[]);g.stroke();g.setLineDash([])};
    if(!VT.world)loadWorld();
    const z=this.z;
    if(z<5||!VT.world){if(VT.world){polys(VT.world.land,col.land);polys(VT.world.lake,col.sea);lines(VT.world.b0,col.muted,.7)}}
    if(z>=4.5){
      const nw=this.fromPx(0,0),se=this.fromPx(this.w,this.h);const tx0=Math.floor((nw[1]+180)/15),tx1=Math.floor((se[1]+180)/15),ty0=Math.floor((se[0]+90)/15),ty1=Math.floor((nw[0]+90)/15);
      const ts=[];for(let x=tx0;x<=tx1;x++)for(let y=Math.max(0,ty0);y<=Math.min(11,ty1);y++){const k=(((x%24)+24)%24)+'_'+y;const t=loadVT(k);if(t)ts.push(t)}
      if(!ts.length&&VT.world){polys(VT.world.land,col.land);polys(VT.world.lake,col.sea);lines(VT.world.b0,col.muted,.7)}
      for(const t of ts)if(t.land)polys(t.land,col.land);
      if(z>=6.5)for(const t of ts)if(t.urban)polys(t.urban,col.urban);
      for(const t of ts)if(t.lake)polys(t.lake,col.sea);
      if(z>=6)for(const t of ts)if(t.river)lines(t.river,col.sea,z>=9?2:1.2,null,c=>z>=8||c===0);
      for(const t of ts)if(t.b1)lines(t.b1,col.line,1,[4,3]);
      for(const t of ts)if(t.b0)lines(t.b0,col.muted,1.2);
      if(z>=5.5)for(const t of ts)if(t.road){lines(t.road,col.road,z>=10?1.4:.8,null,c=>c===2&&z>=8);lines(t.road,col.road,z>=10?2.2:1.1,null,c=>c===1&&z>=6.5);lines(t.road,col.ink,z>=10?2.8:1.3,null,c=>c===0)}
    }
    if(GEO.places){const min=z<3?5e6:z<4?2e6:z<5?1e6:z<6?4e5:z<7?15e4:z<8?6e4:z<9?25e3:z<10?1e4:0;let n=0;
      for(const p of GEO.places){if(p.pop<min)break;const u=mUnit(p.lat,p.lon);this.labels.push({u,n:p.n,rank:p.pop>1e6?1:2,dot:1});if(++n>400)break}}
  }
  // Place names, drawn over whichever basemap: no overlaps, nothing clipped at the edges (C68), body font.
  paintLabels(g,col){const S=this.S(),c=mUnit(...this.center),ox=c[0]*S-this.w/2,oy=c[1]*S-this.h/2;const boxes=[];let n=0;const pad=4;
    const L=this.labels.slice().sort((a,b)=>a.rank-b.rank);
    for(const l of L){let x=l.u[0]*S-ox,y=l.u[1]*S-oy;if(x<-S/2)x+=S;else if(x>this.w+S/2)x-=S;
      g.font=(l.rank<=1?'600 13px ':'500 12px ')+'"Instrument Sans",system-ui,sans-serif';g.textBaseline='middle';const tw=g.measureText(l.n).width;
      const R0=this.w-58; // the control column
      let tx=x+6;if(tx+tw>R0&&y<250)tx=x-6-tw;else if(tx+tw>this.w-pad)tx=x-6-tw;const b=[tx-2,y-8,tx+tw+2,y+8];const right=y<250?R0:this.w-pad;
      if(x<pad||x>right||y<pad+8||y>this.h-pad-22||b[0]<pad||b[2]>right)continue;
      if(boxes.some(q=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1]))continue;boxes.push(b);
      if(l.dot){g.fillStyle=col.ink;g.beginPath();g.arc(x,y,2.2,0,7);g.fill()}
      g.lineWidth=3;g.strokeStyle=col.land;g.strokeText(l.n,tx,y);g.fillStyle=col.ink;g.fillText(l.n,tx,y);if(++n>60)break}}
  paintItems(g,col){
    const items=(this.spec.items?this.spec.items():[]);this.items=items;let hot=false;
    const ring=(ll,km)=>{const c=this.toPx(...ll);const e=this.toPx(ll[0]+km/KM_LAT,ll[1]);return [c,Math.abs(c[1]-e[1])]};
    for(const it of items){
      if(it.type==='cell'){const [a,b]=[this.toPx(it.b[0],it.b[1]),this.toPx(it.b[2],it.b[3])];const blur=it.style==='others';
        g.fillStyle=it.style==='me'||blur?'rgba(200,33,75,.16)':'rgba(36,67,196,.10)';g.strokeStyle=it.style==='me'||blur?col.stamp:col.ball;g.lineWidth=2;
        if(blur){g.fillStyle=dark()?'rgba(0,0,0,.45)':'rgba(255,255,255,.5)';g.fillRect(0,0,this.w,this.h);g.fillStyle='rgba(200,33,75,.22)';g.save();g.filter='blur(4px)';g.fillRect(a[0]-3,b[1]-3,b[0]-a[0]+6,a[1]-b[1]+6);g.restore();g.setLineDash([5,4]);g.strokeRect(a[0],b[1],b[0]-a[0],a[1]-b[1]);g.setLineDash([])}
        else{g.fillRect(a[0],b[1],b[0]-a[0],a[1]-b[1]);g.strokeRect(a[0],b[1],b[0]-a[0],a[1]-b[1])}
        if(it.label){g.font='600 12px "Instrument Sans",system-ui,sans-serif';g.textAlign='center';const tx=Math.max(60,Math.min(this.w-60,(a[0]+b[0])/2)),ty=Math.max(20,Math.min(this.h-24,(a[1]+b[1])/2));g.lineWidth=3;g.strokeStyle=col.paper;g.strokeText(it.label,tx,ty);g.fillStyle=col.ink;g.fillText(it.label,tx,ty);g.textAlign='start'}}
      if(it.type==='area'){const [c,r0]=ring(it.ll,it.km);const rr=Math.max(10,r0);g.beginPath();g.arc(c[0],c[1],rr,0,7);g.fillStyle='rgba(31,122,77,.16)';g.fill();g.setLineDash([4,3]);g.strokeStyle=col.good;g.lineWidth=1.5;g.stroke();g.setLineDash([])}
      if(it.type==='line'&&it.pts.length>1){g.beginPath();it.pts.forEach((p,i)=>{const q=this.toPx(p[0],p[1]);if(i)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1])});g.setLineDash([5,4]);g.strokeStyle=col.ball;g.lineWidth=2;g.stroke();g.setLineDash([])}
      if(it.type==='radius'){const [c,rr]=ring(it.ll,it.km);g.beginPath();g.arc(c[0],c[1],rr,0,7);g.setLineDash([6,5]);g.strokeStyle=col.ink;g.lineWidth=1.5;g.stroke();g.setLineDash([]);g.font='600 12px "Instrument Sans",system-ui,sans-serif';g.fillStyle=col.ink;const ty=c[1]-rr+14;if(ty>4&&ty<this.h)g.fillText(it.km+' km',Math.min(this.w-40,c[0]+4),ty)}
      if(it.type==='acc'&&it.m>0){const [c,rr]=ring(it.ll,it.m/1000);g.beginPath();g.arc(c[0],c[1],Math.max(6,rr),0,7);g.fillStyle='rgba(36,67,196,.10)';g.fill();g.strokeStyle=col.ball;g.lineWidth=1;g.stroke()}
    }
    // markers that can crowd each other cluster into a count bubble (tap it to zoom in)
    const pins=items.filter(it=>it.ll);for(const it of pins)it._px=this.toPx(...it.ll);
    const cand=pins.filter(it=>it.cluster);const cl=clusterPx(cand.map(it=>it._px),30);this.clusters=cl;const inCl=new Set();
    for(const c of cl)if(c.members.length>1)for(const i of c.members)inCl.add(cand[i]);
    for(const it of pins){if(inCl.has(it))continue;const [x,y]=it._px;
      if(it.type==='pin'){g.fillStyle=col.stamp;g.beginPath();g.arc(x,y-14,8,Math.PI*.15,Math.PI*.85,true);g.lineTo(x,y);g.closePath();g.fill();g.fillStyle=col.paper;g.beginPath();g.arc(x,y-14,3,0,7);g.fill()}
      if(it.type==='dot'){g.fillStyle=it.color||col.ball;g.strokeStyle=col.paper;g.lineWidth=2;g.beginPath();g.arc(x,y,6,0,7);g.fill();g.stroke();if(it.label){g.font='600 12px "Instrument Sans",sans-serif';g.fillStyle=col.ink;g.lineWidth=3;g.strokeStyle=col.paper;g.strokeText(it.label,x+9,y+3);g.fillText(it.label,x+9,y+3)}}
      if(it.type==='stamp'){const pulse=it.hot&&!reducedMotion()?(1+.12*Math.sin(Date.now()/250)):1;if(it.hot)hot=true;g.fillStyle=col.paper;g.strokeStyle=it.hot?col.stamp:col.ink;g.lineWidth=2;g.beginPath();g.arc(x,y,15*pulse,0,7);g.fill();g.stroke();g.font='700 10px "IBM Plex Mono",monospace';g.textAlign='center';g.fillStyle=col.ink;g.fillText(it.text,x,y+3.5);g.textAlign='start'}}
    for(const c of cl){if(c.members.length<2)continue;const n=c.members.length;if(c.members.some(i=>cand[i].hot))hot=true;g.fillStyle=col.ink;g.strokeStyle=col.paper;g.lineWidth=2.5;g.beginPath();g.arc(c.x,c.y,15+Math.min(8,n),0,7);g.fill();g.stroke();g.font='700 13px "Instrument Sans",system-ui,sans-serif';g.textAlign='center';g.fillStyle=col.paper;g.fillText(String(n),c.x,c.y+4.5);g.textAlign='start'}
    // the pulse: only markers repaint (the basemap is cached), ~12 fps, only while this map is visible
    if(hot&&!reducedMotion()&&!this.pt)this.pt=setTimeout(()=>{this.pt=0;this.redraw()},80);
    else if(!hot&&this.pt){clearTimeout(this.pt);this.pt=0} // int-1: the pulse ended (drop closed, cluster gone): no leftover frame
  }
}
const dark=()=>document.documentElement.dataset.theme==='dark'||(document.documentElement.dataset.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
// After each screen change, put each live map back in its slot so it keeps its position and loaded tiles.
function mountMaps(){document.querySelectorAll('[data-map]').forEach(slot=>{const k=slot.dataset.map;const m=MAPS[k]||(MAPS[k]=new MapView(k));if(m.el.parentNode!==slot)slot.appendChild(m.el);const spec=MAPSPEC[k]&&MAPSPEC[k]();if(spec)m.set(spec)});
  for(const m of Object.values(MAPS))if(m.el.classList.contains('full')&&!m.el.isConnected)m.full(false)}
const MAPSPEC={};
const slug=s=>String(s||'').normalize('NFD').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'somewhere';
// Zoom so a ring of r km is about 140 px across the middle of the map.
const fitZoom=(lat,r)=>Math.max(3,Math.min(16,Math.log2(156543.03*Math.cos(rad(lat))/(r*1000/140))));
// A theme switch (system or the app's own) recolours the basemap once.
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',bumpMaps);new MutationObserver(bumpMaps).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']})}catch(e){}
