/* ---------- QR codes, built in (C04) ---------- */
// A small byte-mode, level-M encoder for versions 1-10 (up to 213 bytes, plenty for an invite link).
// It replaces the qrcode-generator 1.4.4 script v0.8 loaded from cdnjs, and gives the same modules
// for ASCII text: same version choice, the same Reed-Solomon blocks and the same mask choice
// (that library's penalty rules), so the codes look and scan the same. test/unit/qr.test.js checks it
// against the pinned library on random strings. Text is encoded as UTF-8 (the library sent the low
// byte of each UTF-16 unit, which garbles anything outside Latin-1).
const QR=(()=>{
  const RS=[0,[1,26,16],[1,44,28],[1,70,44],[2,50,32],[2,67,43],[4,43,27],[4,49,31],[2,60,38,2,61,39],[3,58,36,2,59,37],[4,69,43,1,70,44]];
  const AL=[0,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  const EXP=[],LOG=[];for(let i=0,x=1;i<255;i++){EXP[i]=EXP[i+255]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11d}
  const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
  const MASK=[(i,j)=>(i+j)%2==0,i=>i%2==0,(i,j)=>j%3==0,(i,j)=>(i+j)%3==0,(i,j)=>(Math.floor(i/2)+Math.floor(j/3))%2==0,(i,j)=>(i*j)%2+(i*j)%3==0,(i,j)=>((i*j)%2+(i*j)%3)%2==0,(i,j)=>((i*j)%3+(i+j)%2)%2==0];
  const blocks=v=>{const t=RS[v],o=[];for(let k=0;k<t.length;k+=3)for(let j=0;j<t[k];j++)o.push([t[k+1],t[k+2]]);return o};
  const bch=(d,g,n)=>{const len=x=>x?32-Math.clz32(x):0;let r=d<<n;while(len(r)-len(g)>=0)r^=g<<(len(r)-len(g));return (d<<n)|r};
  function ecc(data,n){let g=[1];for(let i=0;i<n;i++){const h=new Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){h[j]^=g[j];h[j+1]^=mul(g[j],EXP[i])}g=h}
    const r=data.concat(new Array(n).fill(0));for(let i=0;i<data.length;i++){const c=r[i];if(c)for(let j=1;j<g.length;j++)r[i+j]^=mul(g[j],c)}return r.slice(data.length)}
  function codewords(bytes,v){
    const bl=blocks(v),cap=bl.reduce((s,b)=>s+b[1],0)*8,bits=[];const put=(x,n)=>{for(let i=n-1;i>=0;i--)bits.push((x>>>i)&1)};
    put(4,4);put(bytes.length,v<10?8:16);bytes.forEach(b=>put(b,8));
    if(bits.length+4<=cap)put(0,4);while(bits.length%8)bits.push(0);for(let p=0;bits.length<cap;p^=1)put(p?0x11:0xEC,8);
    const all=[];for(let i=0;i<bits.length;i+=8)all.push(parseInt(bits.slice(i,i+8).join(''),2));
    const dc=[],ec=[];let off=0;for(const [tot,dat] of bl){const d=all.slice(off,off+dat);off+=dat;dc.push(d);ec.push(ecc(d,tot-dat))}
    const out=[];for(const g of [dc,ec]){const mx=Math.max(...g.map(x=>x.length));for(let i=0;i<mx;i++)for(const x of g)if(i<x.length)out.push(x[i])}
    return out}
  function matrix(v,data,mask,test){
    const n=v*4+17,m=Array.from({length:n},()=>new Array(n).fill(null));
    for(const [R,C] of [[0,0],[n-7,0],[0,n-7]])for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){if(R+r<0||R+r>=n||C+c<0||C+c>=n)continue;m[R+r][C+c]=(r>=0&&r<=6&&(c==0||c==6))||(c>=0&&c<=6&&(r==0||r==6))||(r>=2&&r<=4&&c>=2&&c<=4)}
    const al=AL[v];for(const r0 of al)for(const c0 of al){if(m[r0][c0]!=null)continue;for(let r=-2;r<=2;r++)for(let c=-2;c<=2;c++)m[r0+r][c0+c]=r==-2||r==2||c==-2||c==2||(r==0&&c==0)}
    for(let i=8;i<n-8;i++){if(m[i][6]==null)m[i][6]=i%2==0;if(m[6][i]==null)m[6][i]=i%2==0}
    const fb=bch(mask,0x537,10)^0x5412; // level M is 00
    for(let i=0;i<15;i++){const b=!test&&((fb>>i)&1)==1;m[i<6?i:i<8?i+1:n-15+i][8]=b;m[8][i<8?n-i-1:i<9?15-i:14-i]=b}
    m[n-8][8]=!test;
    if(v>=7){const vb=bch(v,0x1f25,12);for(let i=0;i<18;i++){const b=!test&&((vb>>i)&1)==1;m[Math.floor(i/3)][i%3+n-11]=b;m[i%3+n-11][Math.floor(i/3)]=b}}
    let inc=-1,row=n-1,bit=7,byte=0;const mf=MASK[mask];
    for(let col=n-1;col>0;col-=2){if(col==6)col--;for(;;){for(let c=0;c<2;c++)if(m[row][col-c]==null){let d=byte<data.length&&((data[byte]>>>bit)&1)==1;if(mf(row,col-c))d=!d;m[row][col-c]=d;if(--bit==-1){byte++;bit=7}}
      row+=inc;if(row<0||row>=n){row-=inc;inc=-inc;break}}}
    return m}
  function lost(m){
    const n=m.length;let p=0,dark=0;
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){let s=0;const d=m[r][c];for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){if((!i&&!j)||r+i<0||r+i>=n||c+j<0||c+j>=n)continue;if(m[r+i][c+j]===d)s++}if(s>5)p+=3+s-5;if(d)dark++}
    for(let r=0;r<n-1;r++)for(let c=0;c<n-1;c++){const k=m[r][c]+m[r+1][c]+m[r][c+1]+m[r+1][c+1];if(k==0||k==4)p+=3}
    const f=(g)=>g(0)&&!g(1)&&g(2)&&g(3)&&g(4)&&!g(5)&&g(6);
    for(let r=0;r<n;r++)for(let c=0;c<n-6;c++)if(f(k=>m[r][c+k]))p+=40;
    for(let c=0;c<n;c++)for(let r=0;r<n-6;r++)if(f(k=>m[r+k][c]))p+=40;
    return p+Math.abs(100*dark/n/n-50)/5*10}
  // text -> boolean[][] (true = dark), or null when it doesn't fit version 10
  function make(text,mask){
    const bytes=[...new TextEncoder().encode(String(text))];let v=1;
    for(;v<=10;v++)if(4+(v<10?8:16)+bytes.length*8<=blocks(v).reduce((s,b)=>s+b[1],0)*8)break;
    if(v>10)return null;
    const data=codewords(bytes,v);
    if(mask==null){let best=0,min=0;for(let i=0;i<8;i++){const l=lost(matrix(v,data,i,true));if(i==0||min>l){min=l;best=i}}mask=best}
    return matrix(v,data,mask,false)}
  // The same markup qrcode-generator's createSvgTag({cellSize, margin, scalable:true}) wrote.
  function svg(text,cell=5,margin=2){
    const m=make(text);if(!m)return '';const n=m.length,size=n*cell+margin*2,rect='l'+cell+',0 0,'+cell+' -'+cell+',0 0,-'+cell+'z ';let d='';
    for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(m[r][c])d+='M'+(c*cell+margin)+','+(r*cell+margin)+rect;
    return '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+size+' '+size+'"  preserveAspectRatio="xMinYMin meet"><rect width="100%" height="100%" fill="white" cx="0" cy="0"/><path d="'+d+'" stroke="transparent" fill="black"/></svg>'}
  return {make,svg};
})();
