/* ---------- boot ---------- */
async function boot(){
  draw();
  let db=null,user=null;
  try{if(window.claude&&typeof claude.use==='function'){[db,user]=await Promise.all([claude.use('db'),claude.use('user')]);[downloads,roomCap]=await Promise.all([claude.use('downloads').catch(()=>null),claude.use('room').catch(()=>null)])}}catch(e){}
  let uid=null;if(user){try{uid=await user.id()}catch(e){}}
  if(db&&uid){
    S.mode='live';S.backend='claude';S.db=db;S.uid=uid;S.user=user;
    try{S.isOwner=!!(await user.isOwner())}catch(e){}
    try{const w=await user.can('data.write');if(w===false)S.ui.readonly=true}catch(e){}
    try{const m=await user.me();S.realName=m.name||''}catch(e){}
  }else{
    const hello=await fetch('/api/hello',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null);
    if(hello&&hello.insane){
      S.backend='server';S.hello=hello;MAPCFG.tiles=hello.tiles;MAPCFG.attr=hello.attr;
      if(!hello.signedIn){S.mode='signin';render();loadPlaces();return}
      S.mode='live';S.db=RemoteDB();S.uid=hello.uid;S.isOwner=hello.isOwner;S.email=hello.email;
    }else{S.mode='demo';S.backend='local';S.db=LocalDB();S.uid=localUid();S.isOwner=!/[?&]as=/.test(location.search)||/[?&]as=alice\b/.test(location.search)}
  }
  const hm=/^#([mc])([A-Za-z0-9]{6})$/.exec(location.hash);if(hm){S.deep={kind:hm[1],code:hm[2].toUpperCase()};try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}}
  wire();render();loadPlaces();checkPush();
}
async function signOut(){try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'})}catch(e){}location.reload()}
// What a QR code or shared link opens: this app, with a meeting or invite code after the #.
function appLink(){if(S.backend==='server')return location.origin+'/';if(S.backend==='claude')return 'https://claude.ai/artifact/JHNbWPyCrwVVVHbxbhxf4g';return location.href.split('#')[0]}
function qrSvg(text){try{if(typeof qrcode!=='function')return '';const q=qrcode(0,'M');q.addData(text);q.make();return q.createSvgTag({cellSize:5,margin:2,scalable:true})}catch(e){return ''}}
async function handleDeep(){
  const dl=S.deep;if(!dl||!S.me)return;S.deep=null;
  if(dl.kind==='m'){F.pairin=dl.code;await act('pair',{},null)}
  else if(dl.kind==='c'){if(!S.me.circle){await joinCircle(dl.code)}else toast('You’re already in a circle. Leave it first to join '+dl.code+'.')}
}
