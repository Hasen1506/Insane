/* ---------- the map: real OpenStreetMap tiles where the page may load them, otherwise the bundled world map ---------- */
const MAPCFG={tiles:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attr:'© OpenStreetMap contributors',maxZ:19,tilesOk:null};
const VT={world:null,tiles:new Map(),loadingWorld:null};
function mUnit(lat,lon){const s=Math.sin(rad(Math.max(-85,Math.min(85,lat))));return [(lon+180)/360,.5-Math.log((1+s)/(1-s))/(4*Math.PI)]}
function mInv(x,y){const n=Math.PI-2*Math.PI*y;return [180/Math.PI*Math.atan(.5*(Math.exp(n)-Math.exp(-n))),x*360-180]}
function decodeLine(a,q){const out=new Float64Array(a.length);let x=0,y=0;for(let i=0;i<a.length;i+=2){x+=a[i];y+=a[i+1];const u=mUnit(y/q,x/q);out[i]=u[0];out[i+1]=u[1]}return out}
function loadWorld(){if(VT.loadingWorld)return VT.loadingWorld;VT.loadingWorld=fetch('data/world.json').then(r=>r.json()).then(w=>{VT.world={land:w.land.map(p=>p.map(r=>decodeLine(r,100))),lake:w.lake.map(p=>p.map(r=>decodeLine(r,100))),b0:w.b0.map(l=>decodeLine(l,100))};Object.values(MAPS).forEach(m=>m.redraw())}).catch(()=>{VT.world={land:[],lake:[],b0:[]}});return VT.loadingWorld}
function loadVT(k){if(VT.tiles.has(k))return VT.tiles.get(k);VT.tiles.set(k,null);fetch('data/t/'+k+'.json').then(r=>r.ok?r.json():{}).then(t=>{const d={};for(const L of ['land','lake','urban'])d[L]=(t[L]||[]).map(p=>p.map(r=>decodeLine(r,1e4)));for(const L of ['b0','b1','road','river'])d[L]=(t[L]||[]).map(([c,l])=>[c,decodeLine(l,1e4)]);VT.tiles.set(k,d);Object.values(MAPS).forEach(m=>m.redraw())}).catch(()=>VT.tiles.set(k,{}));return null}
const MAPS={};
class MapView{
  constructor(key){this.key=key;this.el=document.createElement('div');this.el.className='mapv';this.cv=document.createElement('canvas');this.cv.setAttribute('role','img');this.el.appendChild(this.cv);
    this.el.insertAdjacentHTML('beforeend',`<div class="mapctl"><button type="button" data-z="1" aria-label="Zoom in">+</button><button type="button" data-z="-1" aria-label="Zoom out">−</button><button type="button" data-z="0" aria-label="Back to the middle">◎</button></div><div class="mapattr"></div>`);
    this.center=[20,0];this.z=2;this.img=new Map();this.ptr=new Map();this.spec={};this.w=300;this.h=240;this.q=0;
    this.el.querySelectorAll('.mapctl button').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const z=+b.dataset.z;if(z)this.zoomBy(z,this.w/2,this.h/2);else if(this.spec.home){this.center=this.spec.home.slice();this.z=this.spec.zoom||13;this.redraw()}}));
    const cv=this.cv;cv.style.touchAction='none';
    cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);this.ptr.set(e.pointerId,[e.offsetX,e.offsetY]);this.moved=0;this.pinch=null;this.t0=Date.now()});
    cv.addEventListener('pointermove',e=>{const p=this.ptr.get(e.pointerId);if(!p)return;const nx=e.offsetX,ny=e.offsetY;
      if(this.ptr.size===1){const dx=nx-p[0],dy=ny-p[1];this.moved+=Math.abs(dx)+Math.abs(dy);this.panBy(-dx,-dy)}
      else if(this.ptr.size===2){const [a,b]=[...this.ptr.values()];const d0=Math.hypot(a[0]-b[0],a[1]-b[1]);this.ptr.set(e.pointerId,[nx,ny]);const [c,d]=[...this.ptr.values()];const d1=Math.hypot(c[0]-d[0],c[1]-d[1]);if(d0>0)this.zoomBy(Math.log2(d1/d0),(c[0]+d[0])/2,(c[1]+d[1])/2);this.moved+=99;return}
      this.ptr.set(e.pointerId,[nx,ny])});
    const up=e=>{if(!this.ptr.has(e.pointerId))return;this.ptr.delete(e.pointerId);if(this.moved<8&&Date.now()-this.t0<600&&this.ptr.size===0)this.tap(e.offsetX,e.offsetY)};
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',e=>this.ptr.delete(e.pointerId));
    cv.addEventListener('wheel',e=>{e.preventDefault();this.zoomBy(-e.deltaY/(e.deltaMode?3:240),e.offsetX,e.offsetY)},{passive:false});
    cv.addEventListener('dblclick',e=>{e.preventDefault();this.zoomBy(1,e.offsetX,e.offsetY)});
    new ResizeObserver(()=>this.redraw()).observe(this.el);
  }
  set(spec){const first=!this.spec.home;const moved=spec.home&&(!this.spec.home||spec.home[0]!==this.spec.home[0]||spec.home[1]!==this.spec.home[1]);this.spec=spec;if(first||(moved&&spec.follow)){this.center=spec.home?spec.home.slice():[20,0];this.z=spec.zoom??(spec.home?13:2)}this.cv.setAttribute('aria-label',spec.label||'Map');this.redraw()}
  S(){return 256*2**this.z}
  toPx(lat,lon){const S=this.S(),c=mUnit(...this.center),u=mUnit(lat,lon);return [(u[0]-c[0])*S+this.w/2,(u[1]-c[1])*S+this.h/2]}
  fromPx(x,y){const S=this.S(),c=mUnit(...this.center);return mInv(c[0]+(x-this.w/2)/S,c[1]+(y-this.h/2)/S)}
  panBy(dx,dy){const S=this.S(),c=mUnit(...this.center);let ux=c[0]+dx/S,uy=Math.max(.02,Math.min(.98,c[1]+dy/S));ux=((ux%1)+1)%1;this.center=mInv(ux,uy);this.redraw()}
  zoomBy(dz,px,py){const before=this.fromPx(px,py);this.z=Math.max(1.5,Math.min(MAPCFG.tilesOk?MAPCFG.maxZ:16,this.z+dz));const after=this.toPx(...before);this.panBy(after[0]-px,after[1]-py)}
  tap(x,y){const hit=(this.items||[]).filter(i=>i.pick&&i._px&&Math.hypot(i._px[0]-x,i._px[1]-y)<20).sort((a,b)=>Math.hypot(a._px[0]-x,a._px[1]-y)-Math.hypot(b._px[0]-x,b._px[1]-y))[0];
    if(hit&&this.spec.onPick)this.spec.onPick(hit);else if(this.spec.onTap)this.spec.onTap(this.fromPx(x,y))}
  redraw(){if(this.q)return;this.q=requestAnimationFrame(()=>{this.q=0;this.paint()})}
  paint(){
    const r=this.el.getBoundingClientRect();if(!r.width)return;const dpr=Math.min(2,devicePixelRatio||1);this.w=r.width;this.h=r.height;
    if(this.cv.width!==Math.round(this.w*dpr)||this.cv.height!==Math.round(this.h*dpr)){this.cv.width=Math.round(this.w*dpr);this.cv.height=Math.round(this.h*dpr)}
    const g=this.cv.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);const css=getComputedStyle(document.documentElement);const C=k=>css.getPropertyValue(k).trim();
    const col={sea:C('--sea'),land:C('--card'),urban:C('--cell2'),road:C('--muted'),line:C('--line'),ink:C('--ink'),muted:C('--muted'),stamp:C('--stamp'),ball:C('--ball'),good:C('--good'),paper:C('--paper')};
    const useTiles=MAPCFG.tilesOk!==false&&MAPCFG.tiles;
    if(useTiles)this.paintTiles(g,col);else this.paintVector(g,col);
    const at=useTiles&&MAPCFG.tilesOk?esc(MAPCFG.attr):this.z>=11?`Streets: <a href="${osmLink(this.center[0],this.center[1],Math.round(this.z))}" target="_blank" rel="noopener">open this spot in OpenStreetMap ↗</a>`:'Natural Earth · GeoNames';const ae=this.el.querySelector('.mapattr');if(ae.innerHTML!==at)ae.innerHTML=at;
    this.paintItems(g,col);
  }
  paintTiles(g,col){
    g.fillStyle=col.sea;g.fillRect(0,0,this.w,this.h);
    const zi=Math.max(0,Math.min(MAPCFG.maxZ,Math.round(this.z))),n=2**zi,sc=this.S()/(256*n),ts=256*sc;const c=mUnit(...this.center);
    const x0=Math.floor((c[0]*n*256*sc-this.w/2)/ts),x1=Math.floor((c[0]*n*256*sc+this.w/2)/ts),y0=Math.max(0,Math.floor((c[1]*n*256*sc-this.h/2)/ts)),y1=Math.min(n-1,Math.floor((c[1]*n*256*sc+this.h/2)/ts));
    let missing=false;
    for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const xx=((x%n)+n)%n,k=zi+'/'+xx+'/'+y;let im=this.img.get(k);
      if(!im){im=new Image();im.crossOrigin='anonymous';im.onload=()=>{MAPCFG.tilesOk=true;this.redraw()};im.onerror=()=>{if(!MAPCFG.tilesOk){MAPCFG.tilesOk=false;Object.values(MAPS).forEach(m=>m.redraw())}};im.src=MAPCFG.tiles.replace('{z}',zi).replace('{x}',xx).replace('{y}',y);this.img.set(k,im);if(this.img.size>400)this.img.delete(this.img.keys().next().value)}
      const px=x*ts-(c[0]*n*256*sc-this.w/2),py=y*ts-(c[1]*n*256*sc-this.h/2);
      if(im.complete&&im.naturalWidth){if(dark())g.filter='invert(1) hue-rotate(180deg) brightness(.85) contrast(.9)';g.drawImage(im,px,py,ts+.5,ts+.5);g.filter='none'}else missing=true}
    if(missing&&MAPCFG.tilesOk===null)this.paintVector(g,col,true);
  }
  paintVector(g,col,under){
    if(!under){g.fillStyle=col.sea;g.fillRect(0,0,this.w,this.h)}
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
    if(GEO.places){const min=z<3?5e6:z<4?2e6:z<5?1e6:z<6?4e5:z<7?15e4:z<8?6e4:z<9?25e3:z<10?1e4:0;const boxes=[];let n=0;g.font='600 10.5px "IBM Plex Mono",ui-monospace,monospace';g.textBaseline='middle';
      for(const p of GEO.places){if(p.pop<min)break;const [x,y]=this.toPx(p.lat,p.lon);if(x<-40||y<-10||x>this.w+40||y>this.h+10)continue;const tw=g.measureText(p.n).width;const b=[x+4,y-7,x+8+tw,y+7];if(boxes.some(q=>b[0]<q[2]&&b[2]>q[0]&&b[1]<q[3]&&b[3]>q[1]))continue;boxes.push(b);
        g.fillStyle=col.ink;g.beginPath();g.arc(x,y,2.2,0,7);g.fill();g.lineWidth=3;g.strokeStyle=col.land;g.strokeText(p.n,x+6,y);g.fillText(p.n,x+6,y);if(++n>140)break}}
  }
  paintItems(g,col){
    const items=(this.spec.items?this.spec.items():[]);this.items=items;
    for(const it of items){
      if(it.type==='cell'){const [a,b]=[this.toPx(it.b[0],it.b[1]),this.toPx(it.b[2],it.b[3])];g.fillStyle=it.style==='me'?'rgba(200,33,75,.16)':'rgba(36,67,196,.10)';g.strokeStyle=it.style==='me'?col.stamp:col.ball;g.lineWidth=2;g.fillRect(a[0],b[1],b[0]-a[0],a[1]-b[1]);g.strokeRect(a[0],b[1],b[0]-a[0],a[1]-b[1])}
      if(it.type==='area'){const c=this.toPx(...it.ll);const e=this.toPx(it.ll[0]+it.km/KM_LAT,it.ll[1]);const rr=Math.max(10,Math.abs(c[1]-e[1]));g.beginPath();g.arc(c[0],c[1],rr,0,7);g.fillStyle='rgba(31,122,77,.16)';g.fill();g.setLineDash([4,3]);g.strokeStyle=col.good;g.lineWidth=1.5;g.stroke();g.setLineDash([])}
      if(it.type==='line'&&it.pts.length>1){g.beginPath();it.pts.forEach((p,i)=>{const q=this.toPx(p[0],p[1]);if(i)g.lineTo(q[0],q[1]);else g.moveTo(q[0],q[1])});g.setLineDash([5,4]);g.strokeStyle=col.ball;g.lineWidth=2;g.stroke();g.setLineDash([])}
      if(it.type==='radius'){const c=this.toPx(...it.ll);const e=this.toPx(it.ll[0]+it.km/KM_LAT,it.ll[1]);const rr=Math.abs(c[1]-e[1]);g.beginPath();g.arc(c[0],c[1],rr,0,7);g.setLineDash([6,5]);g.strokeStyle=col.ink;g.lineWidth=1.5;g.stroke();g.setLineDash([]);g.font='600 10px "IBM Plex Mono",monospace';g.fillStyle=col.ink;g.fillText(it.km+' km',c[0]+4,c[1]-rr+11)}
    }
    for(const it of items){
      if(!it.ll)continue;const [x,y]=this.toPx(...it.ll);it._px=[x,y];
      if(it.type==='pin'){g.fillStyle=col.stamp;g.beginPath();g.arc(x,y-14,8,Math.PI*.15,Math.PI*.85,true);g.lineTo(x,y);g.closePath();g.fill();g.fillStyle=col.paper;g.beginPath();g.arc(x,y-14,3,0,7);g.fill()}
      if(it.type==='dot'){g.fillStyle=it.color||col.ball;g.strokeStyle=col.paper;g.lineWidth=2;g.beginPath();g.arc(x,y,6,0,7);g.fill();g.stroke();if(it.label){g.font='600 10px "Instrument Sans",sans-serif';g.fillStyle=col.ink;g.lineWidth=3;g.strokeStyle=col.paper;g.strokeText(it.label,x+9,y+3);g.fillText(it.label,x+9,y+3)}}
      if(it.type==='stamp'){const pulse=it.hot?(1+.12*Math.sin(Date.now()/250)):1;g.fillStyle=col.paper;g.strokeStyle=it.hot?col.stamp:col.ink;g.lineWidth=2;g.beginPath();g.arc(x,y,14*pulse,0,7);g.fill();g.stroke();g.font='700 9px "IBM Plex Mono",monospace';g.textAlign='center';g.fillStyle=col.ink;g.fillText(it.text,x,y+3);g.textAlign='start';if(it.hot)this.redraw()}
    }
  }
}
const dark=()=>document.documentElement.dataset.theme==='dark'||(document.documentElement.dataset.theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);
// After each screen change, put each live map back in its slot so it keeps its position and loaded tiles.
function mountMaps(){document.querySelectorAll('[data-map]').forEach(slot=>{const k=slot.dataset.map;const m=MAPS[k]||(MAPS[k]=new MapView(k));if(m.el.parentNode!==slot)slot.appendChild(m.el);const spec=MAPSPEC[k]&&MAPSPEC[k]();if(spec)m.set(spec)})}
const MAPSPEC={};
const slug=s=>String(s||'').normalize('NFD').replace(/[^A-Za-z0-9]+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'somewhere';

