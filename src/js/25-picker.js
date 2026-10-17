/* ---------- picking a place: search, GPS, a pasted link, or a tap on the map ---------- */
function lpState(k){
  const key=k==='home'?'loc':'dloc';if(S.ui[key])return S.ui[key];
  const me=S.me,l=S.priv.loc;let st={lat:null,lon:null,src:'',label:'',prec:'zone',s:2,r:5,q:'',paste:'',area:null,err:'',home:null,zoom:null,remote:[],v:0};
  if(k==='home'&&me&&me.cell){const p=me.prec==='exact'&&l?[l.lat,l.lon]:[me.cell.lat,me.cell.lon];Object.assign(st,{lat:p[0],lon:p[1],src:'saved',prec:me.prec||'zone',s:me.prec==='exact'?2:me.cell.s,r:me.radius||5,home:p,zoom:13,area:me.city?{id:me.city,name:me.cityName,cc:me.cc,lat:(me.areaLL||p)[0],lon:(me.areaLL||p)[1]}:null})}
  if(k==='drop'){const r=myRef();if(r)Object.assign(st,{lat:r[0],lon:r[1],src:'home',home:r,zoom:15})}
  return S.ui[key]=st;
}
function lpSet(st,lat,lon,src,label,zoom){st.lat=+lat;st.lon=+lon;st.src=src;st.label=label||'';st.err='';st.area=null;if(src!=='map'){st.home=[st.lat,st.lon];st.zoom=zoom||14;st.v++}st.q='';st.remote=[];render()}
function guessHome(){try{const tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'';if(!tz.includes('/')||/^Etc\//.test(tz))return [25,10];const c=tz.split('/').pop().replace(/_/g,' ');const p=GEO.places&&searchPlaces(c,1)[0];if(p)return [p.lat,p.lon]}catch(e){}return [25,10]}
function picker(k){
  const st=lpState(k);const res=st.q?searchPlaces(st.q,6):[];const has=st.lat!=null;
  let h=`<label class="f" for="lp-q-${k}">${k==='home'?'Search your town, city or area':'Search for the place'}</label>
  <input class="in-t" id="lp-q-${k}" data-lp="${k}" data-lpf="q" value="${esc(st.q)}" placeholder="${k==='home'?'Ikeja, Brooklyn, Shibuya, Leeds…':'Town or area, then tap the exact spot'}" autocomplete="off" enterkeyhint="search">`;
  if(st.q){const rem=st.remote||[];h+=`<div class="results">${res.map(p=>`<button class="res" data-act="lp-pick" data-k="${k}" data-lat="${p.lat}" data-lon="${p.lon}" data-label="${esc(placeLabel(p))}" data-z="${p.pop>2e6?11:p.pop>2e5?12:13}"><b>${esc(p.n)}</b><span class="meta">${esc([p.a,country(p.cc)].filter(Boolean).join(', '))}</span></button>`).join('')}${rem.map(r=>`<button class="res" data-act="lp-pick" data-k="${k}" data-lat="${r.lat}" data-lon="${r.lon}" data-label="${esc(r.name.split(',').slice(0,3).join(','))}" data-z="16"><b>${esc(r.name.split(',')[0])}</b><span class="meta">${esc(r.name.split(',').slice(1,4).join(','))} · street search</span></button>`).join('')}${!res.length&&!rem.length?`<p class="meta" style="padding:6px 2px">${!GEO.places?'Loading every town on Earth…':S.backend==='server'&&st.q.length>=3?'Looking up streets and places…':'No town by that name. Try the nearest town, then tap the exact spot on the map.'}</p>`:''}</div>`}
  h+=`<div class="btns"><button class="btn s ghost" data-act="lp-gps" data-k="${k}">${ICON.gps}Use my GPS</button><button class="btn s ghost" data-act="lp-paste" data-k="${k}">Paste a maps link</button></div>`;
  if(st.pasting)h+=`<form class="row" data-form="lp-use" data-k="${k}" style="margin-top:8px"><label class="sr" for="lp-p-${k}">Maps link or coordinates</label><input class="in-t grow" id="lp-p-${k}" data-lp="${k}" data-lpf="paste" value="${esc(st.paste)}" placeholder="Maps link, or 38.7139, -9.1394" autocomplete="off"><button class="btn" type="submit">Use</button></form><p class="meta">Google Maps: long-press the spot, then tap the numbers to copy them. Apple Maps: Share, then Copy. OpenStreetMap links work too.</p>`;
  if(st.err)h+=`<p class="read warn" role="alert">${esc(st.err)}</p>`;
  h+=`<div class="mapslot ${k==='home'?'tall':''}" data-map="pick-${k}"></div><p class="meta" style="margin-top:4px">${has?`Pin: ${esc(st.label||(st.src==='gps'?'from GPS':st.src==='saved'?'your saved place':'dropped on the map'))} · ${st.lat.toFixed(4)}, ${st.lon.toFixed(4)}${st.src==='gps'&&st.acc?` · ±${Math.round(st.acc)} m`:''}. Tap the map to move it.`:'Search, use GPS, or tap the map to drop a pin exactly where you mean.'}</p>`;
  if(k==='home'&&has){const area=st.area||areaFor(st.lat,st.lon);const ch=areaChoices(st.lat,st.lon);const cell=cellOf(st.lat,st.lon,st.prec==='exact'?1:st.s);const nn=nearName(cell.lat,cell.lon);
    h+=`<label class="f">How exact?</label><div class="seg" style="margin-top:0">${Object.entries(PREC).map(([v,o])=>`<button data-act="lp-prec" data-v="${v}" class="${st.prec===v?'on':''}" aria-pressed="${st.prec===v}">${o.n}</button>`).join('')}</div><p class="meta">${esc(PREC[st.prec].d)}</p>
    ${st.prec==='zone'?`<div class="chips" style="margin-top:6px">${ZONES.map(s=>`<button class="chip ${st.s===s?'on':''}" data-act="lp-size" data-v="${s}">${s*s} km²</button>`).join('')}</div>`:''}
    <div class="read"><div class="rk">What other people see</div>A ${cell.s*cell.s} km² square${nn?' near '+esc(nn):''}, nothing finer. ${st.prec==='exact'?'Your pin is saved where only you can read it, and used to measure how far drops are.':'Nothing more exact is saved anywhere, so distances are from the middle of the square.'}</div>
    <label class="f">Show me drops within</label><div class="chips">${RADII.map(r=>`<button class="chip ${st.r===r?'on':''}" data-act="lp-radius" data-v="${r}">${r} km</button>`).join('')}</div><p class="meta">Drops further away than this stay off your map, so the next town’s drops don’t crowd yours.</p>
    <label class="f">Your city for the feed, Decode and league</label><div class="chips">${[area,...ch.filter(c=>c.id!==area.id)].slice(0,4).map(a=>`<button class="chip ${(st.area||area).id===a.id?'on':''}" data-act="lp-area" data-v="${esc(JSON.stringify(a))}">${esc(a.name)}</button>`).join('')}</div>`}
  return h;
}
function pickSpec(k){const st=lpState(k);const has=st.lat!=null;
  return {home:st.home||(has?[st.lat,st.lon]:guessHome()),zoom:st.zoom||(has?14:3),follow:true,v:st.v,label:'Map. Tap to set the place.',
    items:()=>{if(!has)return [];const it=[];if(k==='home'){const c=cellOf(st.lat,st.lon,st.prec==='exact'?1:st.s);it.push({type:'radius',ll:[c.lat,c.lon],km:st.r},{type:'cell',b:c.b,style:'me'})}it.push({type:'pin',ll:[st.lat,st.lon]});return it},
    onTap:ll=>lpSet(st,ll[0],ll[1],'map','')}}
MAPSPEC['pick-home']=()=>pickSpec('home');MAPSPEC['pick-drop']=()=>pickSpec('drop');
function homeFields(st){const s=st.prec==='exact'?1:st.s;const cell=cellOf(st.lat,st.lon,s);const area=st.area||areaFor(st.lat,st.lon);
  return {city:area.id,cityName:area.name,cc:area.cc||'',areaLL:[area.lat,area.lon],cell,prec:st.prec,radius:st.r,near:nearName(cell.lat,cell.lon)}}
async function saveHome(st){
  const f=homeFields(st);
  await S.db.doc('people/'+S.uid).update(f);
  if(st.prec==='exact')await S.db.doc(`data/users/${S.uid}/loc`).set({lat:+st.lat.toFixed(6),lon:+st.lon.toFixed(6),src:st.src,acc:st.acc||null,at:now()});
  else if(S.priv.loc)await S.db.doc(`data/users/${S.uid}/loc`).delete();
  return f;
}
let geoT=null;
function remoteSearch(st){clearTimeout(geoT);if(S.backend!=='server'||st.q.length<3){st.remote=[];return}const q=st.q;geoT=setTimeout(async()=>{try{const r=await fetch('/api/geocode?q='+encodeURIComponent(q),{credentials:'same-origin'}).then(x=>x.json());if(st.q===q){st.remote=(r.results||[]).slice(0,5);render()}}catch(e){}},450)}
function gps(st){
  if(!navigator.geolocation){st.err='This browser has no GPS access. Search, tap the map or paste a link instead.';render();return}
  st.err='Finding you…';render();
  navigator.geolocation.getCurrentPosition(p=>{st.acc=p.coords.accuracy;lpSet(st,p.coords.latitude,p.coords.longitude,'gps','',14)},e=>{
    st.err=S.backend==='claude'?'GPS is blocked inside claude.ai pages. Search, tap the map, or paste a link from your phone’s maps app (it uses GPS) instead.':e.code===1?'Location permission is off for this site. Turn it on in your browser settings, or tap the map instead.':'Couldn’t get a GPS fix. Try by a window, or tap the map.';render()},{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}

