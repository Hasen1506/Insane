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
function myRef(){const me=S.me;if(!me)return null;const l=S.priv.loc;if(me.prec==='exact'&&l&&isFinite(l.lat))return [l.lat,l.lon];return me.cell?[me.cell.lat,me.cell.lon]:null}
const cellText=c=>c?`${c.s*c.s} km² square`:'';

