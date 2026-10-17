/* ---------- places: every town of 5,000+ people on Earth, loaded on first use ---------- */
// Fallback when the place file can't load (a file:// demo): a few big cities, plus tap-the-map and coordinates.
const CITIES=[['London',51.507,-0.128,'GB'],['Manchester',53.481,-2.243,'GB'],['Lisbon',38.722,-9.139,'PT'],['Paris',48.857,2.352,'FR'],['Berlin',52.520,13.405,'DE'],['New York City',40.713,-74.006,'US'],['Los Angeles',34.052,-118.244,'US'],['Mexico City',19.433,-99.133,'MX'],['São Paulo',-23.551,-46.633,'BR'],['Lagos',6.524,3.379,'NG'],['Nairobi',-1.292,36.822,'KE'],['Cairo',30.044,31.236,'EG'],['Mumbai',19.076,72.878,'IN'],['Delhi',28.614,77.209,'IN'],['Singapore',1.352,103.820,'SG'],['Jakarta',-6.208,106.846,'ID'],['Tokyo',35.676,139.650,'JP'],['Seoul',37.567,126.978,'KR'],['Sydney',-33.869,151.209,'AU']];
const rad=x=>x*Math.PI/180;
const KM_LAT=111.32;
function distKm(a,b){const dLat=rad(b[0]-a[0]),dLon=rad(b[1]-a[1]);const h=Math.sin(dLat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLon/2)**2;return 2*6371*Math.asin(Math.min(1,Math.sqrt(h)))}
const fmtKm=d=>d<1?Math.round(d*10)*100+' m':d<10?d.toFixed(1)+' km':Math.round(d)+' km';
// A world grid of squares s km a side. Rows are s km tall; each row's columns are s km wide at its middle latitude.
function cellOf(lat,lon,s){const iy=Math.floor(lat*KM_LAT/s);const lat0=iy*s/KM_LAT,lat1=(iy+1)*s/KM_LAT,latC=(lat0+lat1)/2;const kl=KM_LAT*Math.max(.05,Math.cos(rad(latC)));const ix=Math.floor(lon*kl/s);const lon0=ix*s/kl,lon1=(ix+1)*s/kl;
  return {s,id:s+':'+iy+':'+ix,lat:+latC.toFixed(5),lon:+((lon0+lon1)/2).toFixed(5),b:[+lat0.toFixed(5),+lon0.toFixed(5),+lat1.toFixed(5),+lon1.toFixed(5)]}}
// The squares of side s around a point: everything within s km lands in one of these.
function nearCells(lat,lon,s){const out=new Set(),dLat=s/KM_LAT;for(let i=-1;i<=1;i++){const la=lat+i*dLat,dLon=s/(KM_LAT*Math.max(.05,Math.cos(rad(la))));for(let j=-1;j<=1;j++)out.add(cellOf(la,lon+j*dLon,s).id)}return [...out]}
const G=25; // drops are filed under 25 km squares so a query can fetch only the ones near you
const gOf=(lat,lon)=>cellOf(lat,lon,G).id;
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const GEO={places:null,cc:{},loading:null,full:false};
function loadPlaces(){
  if(GEO.loading)return GEO.loading;
  GEO.loading=fetch('data/places.tsv').then(r=>{if(!r.ok)throw new Error(r.status);return r.text()}).then(t=>{
    const L=t.split('\n');GEO.cc=Object.fromEntries(L[0].slice(1).split('|').map(x=>x.split('=')));const adm=L[1].slice(1).split('|');const P=[];
    for(let i=2;i<L.length;i++){const p=L[i].split('\t');if(p.length<6)continue;P.push({n:p[0],lat:+p[1],lon:+p[2],cc:p[3],a:p[4]===''?'':adm[+p[4]],pop:+p[5],k:norm(p[0])})}
    GEO.places=P;GEO.full=true;render();if(typeof MAPS!=='undefined')Object.values(MAPS).forEach(m=>m.redraw());return P})
  .catch(()=>{GEO.places=CITIES.map(c=>({n:c[0],lat:c[1],lon:c[2],cc:c[3],a:'',pop:1e6,k:norm(c[0])}));return GEO.places});
  return GEO.loading;
}
const country=cc=>GEO.cc[cc]||cc;
const placeLabel=p=>[p.n,p.a&&p.a!==p.n?p.a:'',country(p.cc)].filter(Boolean).join(', ');
function searchPlaces(q,limit=8){
  if(!GEO.places)return [];const [a,...rest]=q.split(',');const k=norm(a),r=norm(rest.join(' '));if(!k)return [];
  const pre=[],sub=[];
  for(const p of GEO.places){if(r&&!norm(p.a+' '+country(p.cc)+' '+p.cc).includes(r))continue;
    if(p.k===k||p.k.startsWith(k+' ')||p.k.startsWith(k))pre.push(p);else if(sub.length<limit&&p.k.includes(k))sub.push(p);if(pre.length>=limit)break}
  return [...pre,...sub].slice(0,limit);
}
// Your "city" for the feed, Decode, calls and league: the big place you're near, so a suburb and its centre share one.
function areaFor(lat,lon){
  const P=GEO.places||[];let best=null;const near=(min,km)=>{let b=null;for(const p of P){if(p.pop<min)continue;const d=distKm([lat,lon],[p.lat,p.lon]);if(d<=km&&(!b||d<b.d))b={p,d}}return b};
  // A city of a million or more nearby wins, so Tokyo's wards and Lagos's suburbs share one feed and Decode.
  best=near(1e6,35)||near(300000,35)||near(50000,22)||near(0,1e5);
  if(!best)return {id:'xx-'+gOf(lat,lon),name:'Here',cc:'',lat,lon};
  const p=best.p;return {id:(p.cc+'-'+norm(p.a)+'-'+norm(p.n)).replace(/ /g,'_'),name:p.n,cc:p.cc,country:country(p.cc),lat:p.lat,lon:p.lon};
}
function areaChoices(lat,lon){const P=GEO.places||[];const out=[];for(const p of P){if(p.pop<20000)break;const d=distKm([lat,lon],[p.lat,p.lon]);if(d<=30)out.push({p,d})}
  const seen=new Set();return out.sort((a,b)=>b.p.pop-a.p.pop).filter(x=>{const id=x.p.cc+x.p.n;if(seen.has(id))return false;seen.add(id);return true}).slice(0,4).map(x=>({id:(x.p.cc+'-'+norm(x.p.a)+'-'+norm(x.p.n)).replace(/ /g,'_'),name:x.p.n,cc:x.p.cc,country:country(x.p.cc),lat:x.p.lat,lon:x.p.lon}))}
function nearName(lat,lon){const P=GEO.places||[];let b=null;for(const p of P){const d=distKm([lat,lon],[p.lat,p.lon]);if(!b||d<b.d)b={p,d}}return b&&b.d<8?b.p.n:''}
// Coordinates from whatever people paste: Google, Apple or OpenStreetMap links, geo: links, or "lat, lon".
function parseLL(s){
  s=String(s||'').trim();if(!s)return null;let m;
  const ok=(a,b)=>{a=+a;b=+b;return isFinite(a)&&isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180&&!(a===0&&b===0)?[a,b]:null};
  try{s=decodeURIComponent(s)}catch(e){}
  if((m=/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(s)))return ok(m[1],m[2]);
  if((m=/@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s)))return ok(m[1],m[2]);
  if((m=/[?&](?:q|ll|query|daddr|sll|center)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/.exec(s)))return ok(m[1],m[2]);
  if((m=/mlat=(-?\d+\.\d+).*?mlon=(-?\d+\.\d+)/.exec(s)))return ok(m[1],m[2]);
  if((m=/#map=\d+(?:\.\d+)?\/(-?\d+\.\d+)\/(-?\d+\.\d+)/.exec(s)))return ok(m[1],m[2]);
  if((m=/geo:(-?\d+\.\d+),(-?\d+\.\d+)/.exec(s)))return ok(m[1],m[2]);
  if((m=/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s)))return ok(m[1],m[2]);
  if((m=/(\d{1,2}(?:\.\d+)?)°?\s*([NS])[,\s]+(\d{1,3}(?:\.\d+)?)°?\s*([EW])/i.exec(s)))return ok((/s/i.test(m[2])?-1:1)*m[1],(/w/i.test(m[4])?-1:1)*m[3]);
  return null;
}
const osmLink=(lat,lon,z=17)=>`https://www.openstreetmap.org/?mlat=${(+lat).toFixed(5)}&mlon=${(+lon).toFixed(5)}#map=${z}/${(+lat).toFixed(5)}/${(+lon).toFixed(5)}`;
const gmapLink=(lat,lon)=>`https://www.google.com/maps/search/?api=1&query=${(+lat).toFixed(5)},${(+lon).toFixed(5)}`;
const PREC={exact:{n:'Exact, kept private',d:'Your exact spot stays in your private space; nobody else can read it. Others see a 1 km² square.'},zone:{n:'A zone only',d:'Only a square is saved, not even privately. Distances are worked out from its middle.'}};
const ZONES=[1,2,3]; // square side in km: 1, 4 or 9 km²
const RADII=[2,5,10,25];
/* ---------- places in pieces (C81): a phone loads its own country, never the 2.7 MB world list ----------
   Local and artifact mode: data/places/index.json (versioned, small), then content-hashed chunks that cache forever:
   big.<h>.tsv (cities of 300,000+ everywhere, so search still finds Manchester from Lisbon) and <CC>.<h>.tsv for
   each country near a point. Server mode loads none of it: search and areas come from /api/places and /api/place,
   computed on the server with this same code. loadPlaces() above stays the whole-world loader (search every
   country, and tests). */
GEO.ix=null;GEO.have=new Set();GEO.rows=[];GEO.ixLoading=null;GEO.chunk=new Map();
function parseChunk(t){const L=t.split('\n');const cc=Object.fromEntries(L[0].slice(1).split('|').filter(Boolean).map(x=>x.split('=')));const adm=L[1].slice(1).split('|');const P=[];
  for(let i=2;i<L.length;i++){const p=L[i].split('\t');if(p.length<6)continue;P.push({n:p[0],lat:+p[1],lon:+p[2],cc:p[3],a:p[4]===''?'':adm[+p[4]],pop:+p[5],k:norm(p[0])})}return {cc,P}}
// Merge loaded chunks into one list sorted by population (the order every scan above relies on), without duplicates.
function mergePlaces(lists){const seen=new Set(),out=[];for(const L of lists)for(const p of L){const id=p.n+'|'+p.lat+'|'+p.lon;if(seen.has(id))continue;seen.add(id);out.push(p)}
  return out.sort((a,b)=>b.pop-a.pop)}
function placesIndex(){if(GEO.ixLoading)return GEO.ixLoading;GEO.ixLoading=fetch('data/places/index.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(ix=>{GEO.ix=ix;return ix}).catch(()=>null);return GEO.ixLoading}
function loadChunk(key){if(GEO.chunk.has(key))return GEO.chunk.get(key);const ix=GEO.ix;const f=!ix?null:key==='big'?ix.big:ix.files[key]&&ix.files[key].f;if(!f)return Promise.resolve(null);
  const pr=fetch('data/places/'+f).then(r=>{if(!r.ok)throw new Error(r.status);return r.text()}).then(t=>{if(GEO.full)return null;const c=parseChunk(t);Object.assign(GEO.cc,c.cc);GEO.have.add(key);GEO.rows.push(c.P);GEO.places=mergePlaces(GEO.rows);
    if(typeof render==='function')render();if(typeof MAPS!=='undefined')Object.values(MAPS).forEach(m=>m.redraw());return c.P}).catch(()=>{GEO.chunk.delete(key);return null});
  GEO.chunk.set(key,pr);return pr}
// Countries whose towns could matter for a point: any town within 35 km decides its city (areaFor), so pad each
// country's box by ~55 km. If the nearest loaded town is still far (open sea, a border desert), load everything.
function countriesNear(ix,lat,lon,padKm=55){const dLat=padKm/KM_LAT,dLon=padKm/(KM_LAT*Math.max(.05,Math.cos(rad(lat))));
  return Object.entries(ix.files).filter(([,v])=>lat>=v.bb[0]-dLat&&lat<=v.bb[2]+dLat&&lon>=v.bb[1]-dLon&&lon<=v.bb[3]+dLon).map(([k])=>k)}
async function placesNear(lat,lon){if(GEO.full)return GEO.places;const ix=await placesIndex();if(!ix)return loadPlaces();
  await Promise.all(['big',...countriesNear(ix,lat,lon)].map(loadChunk));
  const P=GEO.places||[];let best=1e9;for(const p of P){const d=distKm([lat,lon],[p.lat,p.lon]);if(d<best)best=d;if(best<50)break}
  if(best>=50)return loadPlaces();return GEO.places}
async function placesFor(cc){const ix=await placesIndex();if(!ix)return loadPlaces();return Promise.all(['big',cc].filter(k=>k==='big'||ix.files[k]).map(loadChunk))}
function placesBoot(){if(S.backend==='server')return;placesIndex().then(ix=>{if(!ix){loadPlaces();return}const g=tzGuess();placesFor(g.cc||'')})}
/* ---------- the first view, before anyone has a place (C64): from the timezone, never the middle of Africa ---------- */
const TZ0={'Asia/Kolkata':[20.36,82.49,4.3,'IN'],'Asia/Calcutta':[20.36,82.49,4.3,'IN'],'Asia/Colombo':[7.9,80.7,7,'LK'],'Asia/Dhaka':[23.7,90.4,6.3,'BD'],'Asia/Karachi':[29.9,69.4,4.7,'PK'],'Asia/Kathmandu':[28.2,84.1,6,'NP'],'Asia/Dubai':[24.4,54.6,6.4,'AE'],'Asia/Singapore':[1.35,103.82,9,'SG'],'Asia/Tokyo':[35.68,139.69,5,'JP'],'Asia/Jakarta':[-6.21,106.85,5,'ID'],'Europe/London':[53.5,-2.36,6.3,'GB'],'Europe/Lisbon':[38.72,-9.13,5,'PT'],'Europe/Paris':[46.6,2.4,5.2,'FR'],'Europe/Berlin':[51.1,10.4,5.3,'DE'],'America/New_York':[40.71,-74,5,'US'],'America/Los_Angeles':[34.05,-118.24,5,'US'],'America/Chicago':[41.85,-87.65,5,'US'],'America/Sao_Paulo':[-23.53,-46.62,5,'BR'],'Africa/Lagos':[8.7,6.4,5,'NG'],'Africa/Nairobi':[-0.6,37.4,5.5,'KE'],'Australia/Sydney':[-33.87,151.21,5,'AU']};
const TZC={Asia:[25,90,3],Europe:[50,10,3.5],Africa:[5,20,3],America:[15,-80,2.5],Australia:[-25,134,3.5],Pacific:[-15,170,3],Atlantic:[30,-30,2.5],Indian:[-10,75,3],Antarctica:[-75,0,2]};
const myTz=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch(e){return ''}};
function tzGuess(tz){tz=tz==null?myTz():tz;const v=(GEO.ix&&GEO.ix.tz&&GEO.ix.tz[tz])||TZ0[tz]||(GEO.guess&&GEO.guess.tz===tz&&GEO.guess.v);
  if(v)return {lat:v[0],lon:v[1],z:v[2],cc:v[3]||'',tz};const c=TZC[String(tz).split('/')[0]];return c?{lat:c[0],lon:c[1],z:c[2],cc:'',tz}:{lat:20,lon:20,z:2,cc:'',tz}}
// Server mode: the server holds the whole timezone table (and can read a CDN's country header); ask once.
function tzGuessRemote(){if(S.backend!=='server'||GEO.guess)return;const tz=myTz();GEO.guess={tz,v:null};fetch('/api/place/guess?tz='+encodeURIComponent(tz),{credentials:'same-origin'}).then(r=>r.json()).then(g=>{if(g&&g.v){GEO.guess={tz,v:g.v,cc:g.cc};if(typeof render==='function')render()}}).catch(()=>{})}
/* ---------- everything the picker needs about a point, the same in both modes ---------- */
// {area, choices, near:{1,2,3}}: the city for the feed, the cities to choose from, and the "near X" name for each zone size.
function placeInfoLocal(lat,lon){const near={};for(const s of ZONES){const c=cellOf(lat,lon,s);near[s]=nearName(c.lat,c.lon)}return {area:areaFor(lat,lon),choices:areaChoices(lat,lon),near}}
async function placeInfo(lat,lon){
  if(S.backend==='server'){try{const r=await fetch(`/api/place?lat=${(+lat).toFixed(6)}&lon=${(+lon).toFixed(6)}`,{credentials:'same-origin'});if(r.ok)return await r.json()}catch(e){}return null}
  await placesNear(lat,lon);return placeInfoLocal(lat,lon)}
// Search results, grouped so a town is never buried under street hits (C67): Towns, then Neighbourhoods, then Streets
// and places, each with a distance from where the map is looking.
const NBH=new Set(['suburb','neighbourhood','quarter','village','hamlet','city_block','borough','residential','locality','town','city','municipality','administrative','isolated_dwelling']);
function groupResults(local,remote,ref){
  const km=(a,b)=>ref?distKm(ref,[a,b]):null;
  const towns=(local||[]).map(p=>({g:'town',n:p.n,sub:[p.a&&p.a!==p.n?p.a:'',p.country||country(p.cc)].filter(Boolean).join(', '),lat:p.lat,lon:p.lon,z:p.pop>2e6?11:p.pop>2e5?12:13,km:km(p.lat,p.lon),label:[p.n,p.a&&p.a!==p.n?p.a:'',p.country||country(p.cc)].filter(Boolean).join(', ')}));
  const tk=new Set(towns.map(t=>norm(t.n)));
  const nb=[],st=[];
  for(const r of remote||[]){const parts=String(r.name||'').split(',').map(x=>x.trim()).filter(Boolean);if(!parts.length)continue;const n=parts[0];
    if(tk.has(norm(n))&&towns.some(t=>distKm([t.lat,t.lon],[r.lat,r.lon])<3))continue; // the same town again
    const x={g:NBH.has(r.kind)?'nbh':'street',n,sub:parts.slice(1,4).join(', '),lat:+r.lat,lon:+r.lon,z:NBH.has(r.kind)?15:17,km:km(+r.lat,+r.lon),label:parts.slice(0,3).join(', ')};(x.g==='nbh'?nb:st).push(x)}
  return {towns,nbh:nb,streets:st,all:[...towns,...nb,...st]};
}
function myRef(){const me=S.me;if(!me)return null;const l=S.priv.loc;if(me.prec==='exact'&&l&&isFinite(l.lat))return [l.lat,l.lon];return me.cell?[me.cell.lat,me.cell.lon]:null}
const cellText=c=>c?`${c.s*c.s} km² square`:'';

