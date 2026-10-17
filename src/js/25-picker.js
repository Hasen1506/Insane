/* ---------- the place picker: one shared component (onboarding, Profile, host a drop, Mission, trail stop) ----------
   Stable API (WS-B and the sheets use only these):
     picker(k)          HTML for kind k: 'home' (where you live, with privacy) or 'drop' (a spot: drop, Mission, trail stop)
     lpState(k)         the picker's state: {lat, lon, src, label, prec:'zone'|'exact', s, r, area, geo, …}
     lpReady(st)        resolves once the city and "near" names for the current pin are known (await before homeFields)
     homeFields(st)     the public profile fields for a home pick; publicCell(st) is the square others see
     saveHome(st)       writes them, plus the private exact pin when prec is 'exact'
   Design (PLAN §7, C64–C67): it opens on your region (from the timezone, never the middle of Africa); one primary
   "Use my location", with a search box beneath that also takes pasted map links and coordinates; results grouped
   Towns · Neighbourhoods · Streets with distances; Zone (1 km²) is the default; a You see / Others see toggle on the
   same map shows exactly what is stored publicly, drawn by the same publicCell() the save uses. */
function lpState(k){
  const key=k==='home'?'loc':'dloc';if(S.ui[key])return S.ui[key];
  const me=S.me,l=S.priv.loc;let st={lat:null,lon:null,src:'',label:'',prec:'zone',s:1,r:5,q:'',area:null,geo:null,err:'',home:null,zoom:null,remote:[],local:null,more:false,view:'you',v:0};
  if(k==='home'&&me&&me.cell){const p=me.prec==='exact'&&l?[l.lat,l.lon]:[me.cell.lat,me.cell.lon];Object.assign(st,{lat:p[0],lon:p[1],src:'saved',prec:me.prec||'zone',s:me.prec==='exact'?1:me.cell.s,r:me.radius||5,home:p,zoom:13,area:me.city?{id:me.city,name:me.cityName,cc:me.cc,lat:(me.areaLL||p)[0],lon:(me.areaLL||p)[1]}:null});lpGeo(st)}
  if(k==='drop'){const r=myRef();if(r)Object.assign(st,{lat:r[0],lon:r[1],src:'home',home:r,zoom:15})}
  return S.ui[key]=st;
}
function lpSet(st,lat,lon,src,label,zoom){st.lat=+lat;st.lon=+lon;st.src=src;st.label=label||'';st.err='';st.area=null;if(src!=='map'){st.home=[st.lat,st.lon];st.zoom=zoom||14;st.v++}st.q='';st.remote=[];st.local=null;st.more=false;if(src!=='gps')st.acc=null;lpGeo(st);render()}
// The city, the cities to choose from and the "near X" names for the pin: from the server in server mode, else local.
function lpGeo(st){if(st.lat==null)return;const at=st.lat+','+st.lon;st.geoAt=at;st.geoP=placeInfo(st.lat,st.lon).then(g=>{if(st.geoAt===at&&g){st.geo=g;render()}}).catch(()=>{})}
const lpReady=st=>st&&st.geoP?st.geoP:Promise.resolve();
const regionName=cc=>{try{return new Intl.DisplayNames(['en'],{type:'region'}).of(cc)||country(cc)}catch(e){return country(cc)}};
const publicCell=st=>cellOf(st.lat,st.lon,st.prec==='exact'?1:st.s);
function guessHome(){const g=tzGuess();return g}
const SV=d=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${d}</svg>`;
const RICON={town:SV('<path d="M3 21V9l5-3v15M8 21V4l8 4v13M16 21v-9l5 2v7M2 21h20"/>'),nbh:SV('<path d="M3 11l5-4 5 4v9H3zM13 13l4-3 4 3v7h-8"/>'),street:SV('<path d="M12 21s-6-6.2-6-11a6 6 0 0 1 12 0c0 4.8-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>'),link:SV('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>')};
function resRow(k,r){return `<button class="res" data-act="lp-pick" data-k="${k}" data-lat="${r.lat}" data-lon="${r.lon}" data-label="${esc(r.label)}" data-z="${r.z}" data-src="${r.src||'search'}"><span class="ri" aria-hidden="true">${r.icon||RICON[r.g]}</span><span class="grow"><b>${esc(r.n)}</b><span class="meta">${esc(r.sub)}</span></span>${r.km!=null?`<span class="rd">${fmtKm(r.km)}</span>`:''}</button>`}
function lpResults(k,st){
  const ll=parseLL(st.q);const ref=st.lat!=null?[st.lat,st.lon]:null; // no distance from a country-sized guess
  if(ll)return `<div class="results">${resRow(k,{g:'street',icon:RICON.link,n:'This spot',sub:`${ll[0].toFixed(5)}, ${ll[1].toFixed(5)} · from what you pasted`,lat:ll[0],lon:ll[1],z:16,km:ref?distKm(ref,ll):null,label:'',src:'link'})}</div>`;
  const local=S.backend==='server'?(st.local||[]):searchPlaces(st.q,6);
  const R=groupResults(local,st.remote||[],ref);
  const grp=(t,rows)=>rows.length?`<div class="rgrp">${t}</div>${rows.map(r=>resRow(k,r)).join('')}`:'';
  let h=grp('Towns and cities',R.towns)+grp('Neighbourhoods',R.nbh);
  if(R.streets.length)h+=st.more||!R.towns.length?grp('Streets and places',R.streets):`<button class="rmore" data-act="lp-more" data-k="${k}">More precise places (${R.streets.length})</button>`;
  if(!R.all.length){const busy=S.backend==='server'?(st.q.length>=2&&st.local==null)||(st.q.length>=3&&st.remoteQ!==st.q):!GEO.places;
    h=`<p class="meta" style="padding:8px 11px">${busy?'Looking…':'Nothing by that name nearby. Try the nearest town, then tap the exact spot on the map.'}</p>${S.backend!=='server'&&!GEO.full&&GEO.places?`<button class="rmore" data-act="lp-world" data-k="${k}">Search every country</button>`:''}`}
  return `<div class="results">${h}</div>`;
}
function picker(k){
  const st=lpState(k);const has=st.lat!=null;const g=guessHome();const cn=g.cc?regionName(g.cc):'';
  if(S.backend==='server')tzGuessRemote();
  let h=`<button class="btn lp-gps" data-act="lp-gps" data-k="${k}">${ICON.gps}${has&&st.src==='gps'?'Use my location again':'Use my location'}</button>
  <label class="f lp-or" for="lp-q-${k}">${k==='home'?'or search your town or area, or paste a maps link':'or search for the place, or paste a maps link'}</label>
  <input class="in-t" id="lp-q-${k}" data-lp="${k}" data-lpf="q" value="${esc(st.q)}" placeholder="${cn&&cn.length<20?`A town or area in ${esc(cn)}`:'A town, area or maps link'}" autocomplete="off" enterkeyhint="search" inputmode="search">`;
  if(st.q)h+=lpResults(k,st);
  if(st.err)h+=`<p class="read warn" role="alert">${esc(st.err)}</p>`;
  const others=k==='home'&&has&&st.view==='others';
  h+=`<div class="mapslot ${k==='home'?'tall':''}" data-map="pick-${k}"></div><p class="meta" style="margin-top:4px">${has?`Pin: ${esc(st.label||(st.src==='gps'?'from GPS':st.src==='saved'?'your saved place':st.src==='link'?'from your link':st.src==='home'?'your place':'dropped on the map'))}${st.src==='gps'&&st.acc?` · ±${Math.round(st.acc)} m`:''}. Tap the map to move it.`:'Use your location, search, or zoom in and tap the map where you mean.'}</p>`;
  if(k==='home'&&has){const area=st.area||(st.geo&&st.geo.area)||areaFor(st.lat,st.lon);const ch=(st.geo&&st.geo.choices)||areaChoices(st.lat,st.lon);const cell=publicCell(st);const nn=(st.geo&&st.geo.near&&st.geo.near[cell.s])??nearName(cell.lat,cell.lon);
    const sq=`${cell.s*cell.s} km² square${nn?' near '+esc(nn):''}`;
    h+=`<div class="lpview" role="group" aria-label="Preview"><button data-act="lp-view" data-k="${k}" data-v="you" class="${st.view!=='others'?'on':''}" aria-pressed="${st.view!=='others'}">You see</button><button data-act="lp-view" data-k="${k}" data-v="others" class="${others?'on':''}" aria-pressed="${others}">Others see</button></div>
    <p class="lpsee">${others?`Everyone else sees <b>a ${sq}</b>. Nothing finer, ever.`:st.prec==='exact'?'You see your pin. It is saved where only you can read it.':`You see the pin while you choose. Only the <b>${sq}</b> is saved.`}</p>
    <label class="f">How exact?</label><div class="seg" style="margin-top:0">${Object.entries(PREC).map(([v,o])=>`<button data-act="lp-prec" data-v="${v}" class="${st.prec===v?'on':''}" aria-pressed="${st.prec===v}">${v==='zone'?'A zone (recommended)':'Exact, kept private'}</button>`).join('')}</div><p class="meta">${st.prec==='exact'?'Only you can see the pin; it makes distances to drops exact. Others still see a 1 km² square.':'Only the square is saved, not even privately. Distances are from its middle.'}</p>
    ${st.prec==='zone'?`<div class="chips mapchips" style="margin-top:6px">${ZONES.map(s=>`<button class="chip ${st.s===s?'on':''}" data-act="lp-size" data-v="${s}" aria-pressed="${st.s===s}">${s*s} km²</button>`).join('')}</div>`:''}
    <label class="f">Show me drops within</label><div class="chips mapchips">${RADII.map(r=>`<button class="chip ${st.r===r?'on':''}" data-act="lp-radius" data-v="${r}" aria-pressed="${st.r===r}">${r} km</button>`).join('')}</div><p class="meta">The dashed ring. Drops further away stay off your map.</p>
    <label class="f">Your city for the feed, Decode and league</label><div class="chips mapchips">${[area,...ch.filter(c=>c.id!==area.id)].slice(0,4).map(a=>`<button class="chip ${(st.area||area).id===a.id?'on':''}" data-act="lp-area" data-v="${esc(JSON.stringify(a))}">${esc(a.name)}</button>`).join('')}</div>`}
  return h;
}
function pickSpec(k){const st=lpState(k);const has=st.lat!=null;const g=guessHome();
  // without a street basemap the bundled map has nothing to show past town level, so stop at 12.5 there
  const zmax=MAPCFG.kind==='none'||MAPCFG.tilesOk===false?12.5:19;
  return {home:st.home||(has?[st.lat,st.lon]:[g.lat,g.lon]),zoom:Math.min(zmax,st.zoom||(has?14:g.z)),follow:true,v:st.v,label:has?'Map of your pick. Tap to move the pin.':'Map. Zoom in and tap to drop a pin.',
    items:()=>{if(!has)return [];const it=[];
      if(k==='home'){const c=publicCell(st);const nn=(st.geo&&st.geo.near&&st.geo.near[c.s])??nearName(c.lat,c.lon);it.push({type:'radius',ll:[c.lat,c.lon],km:st.r});
        if(st.view==='others')return it.concat({type:'cell',b:c.b,style:'others',label:nn?'near '+nn:''}); // no pin, ever, in what others see
        if(st.prec==='zone')it.push({type:'cell',b:c.b,style:'me'})}
      if(st.src==='gps'&&st.acc)it.push({type:'acc',ll:[st.lat,st.lon],m:st.acc});
      it.push({type:'pin',ll:[st.lat,st.lon]});return it},
    // before there's a pin, a tap on a zoomed-out map zooms in instead of dropping a pin in the wrong town
    onTap:(ll,m)=>{if(!has&&m&&m.z<10){const p=m.toPx(ll[0],ll[1]);m.zoomBy(Math.min(4,10-m.z),p[0],p[1]);return}lpSet(st,ll[0],ll[1],'map','')}}}
MAPSPEC['pick-home']=()=>pickSpec('home');MAPSPEC['pick-drop']=()=>pickSpec('drop');
function homeFields(st){const cell=publicCell(st);const geo=st.geo;let area=st.area||(geo&&geo.area)||areaFor(st.lat,st.lon);
  // no town known (places not loaded, open sea): the fallback area sits on the pin itself, so work it out from the square's middle
  if(/^xx-/.test(area.id))area=areaFor(cell.lat,cell.lon);const areaLL=[area.lat,area.lon];
  const near=geo&&geo.near&&geo.near[cell.s]!=null?geo.near[cell.s]:nearName(cell.lat,cell.lon);
  return {city:area.id,cityName:area.name,cc:area.cc||'',areaLL,cell,prec:st.prec,radius:st.r,near}}
async function saveHome(st){
  await lpReady(st);const f=homeFields(st);
  await S.db.doc('people/'+S.uid).update(f);
  if(st.prec==='exact')await S.db.doc(`data/users/${S.uid}/loc`).set({lat:+st.lat.toFixed(6),lon:+st.lon.toFixed(6),src:st.src,acc:st.acc||null,at:now()});
  else if(S.priv.loc)await S.db.doc(`data/users/${S.uid}/loc`).delete();
  return f;
}
// Search as you type: towns from the server's list (server mode) at once, streets and neighbourhoods from the geocoder after a pause.
let geoT=null,geoT2=null;
function remoteSearch(st){clearTimeout(geoT);clearTimeout(geoT2);st.more=false;if(S.backend!=='server'||parseLL(st.q)){st.remote=[];st.local=null;return}const q=st.q;
  if(q.length<2){st.local=[];st.remote=[];return}
  geoT2=setTimeout(async()=>{try{const r=await fetch('/api/places?q='+encodeURIComponent(q),{credentials:'same-origin'}).then(x=>x.json());if(st.q===q){st.local=(r.results||[]).slice(0,6);render()}}catch(e){if(st.q===q){st.local=[];render()}}},120);
  if(q.length<3){st.remote=[];return}
  geoT=setTimeout(async()=>{try{const r=await fetch('/api/geocode?q='+encodeURIComponent(q),{credentials:'same-origin'}).then(x=>x.json());if(st.q===q){st.remote=(r.results||[]).slice(0,6);st.remoteQ=q;render()}}catch(e){if(st.q===q){st.remoteQ=q;render()}}},450)}
function gps(st){
  if(!navigator.geolocation){st.err='This browser has no location access. Search for your town instead, or paste a maps link.';render();return}
  st.err='Finding you…';render();
  navigator.geolocation.getCurrentPosition(p=>{st.acc=p.coords.accuracy;lpSet(st,p.coords.latitude,p.coords.longitude,'gps','',p.coords.accuracy>2000?12:15)},e=>{
    st.err=S.backend==='claude'?'Location is blocked inside claude.ai pages. Search for your town, or paste a link from your phone’s maps app.':e.code===1?'Location permission is off for this site. Turn it on in your browser settings, or search instead.':'Couldn’t get a location fix. Try by a window, or search instead.';render()},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}
// Enter in the search box takes the first result.
document.addEventListener('keydown',e=>{const el=e.target;if(e.key!=='Enter'||!el||!el.dataset||el.dataset.lpf!=='q')return;e.preventDefault();const b=el.parentNode&&el.parentNode.querySelector('.results .res');if(b)b.click()});
