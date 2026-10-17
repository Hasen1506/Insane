'use strict';
/* ---------- tiny helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let CLOCK_SKEW=0; // server mode: the server's clock minus this phone's, when they disagree by more than 5 s (C61)
const now=()=>Date.now()+CLOCK_SKEW;
const MIN=6e4,HOUR=36e5,DAY=864e5;
const ALPH='abcdefghijkmnpqrstuvwxyz23456789',CODEA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rnd=(n,a=ALPH)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>a[x%a.length]).join('');
const fnv=s=>{let h=0x811c9dc5;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,0x01000193)>>>0}return h.toString(16)};
const fnvN=s=>parseInt(fnv(s),16);
const pairId=(a,b)=>[a,b].sort().join('__');
const initials=n=>(String(n||'?').trim()[0]||'?').toUpperCase();
const ymd=t=>{const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const today=()=>ymd(now());
const dayStart=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
function weekStart(t=now()){const d=new Date(dayStart(t));const wd=(d.getDay()+6)%7;return d.getTime()-wd*DAY}
function weekKey(t=now()){const d=new Date(t);d.setHours(0,0,0,0);d.setDate(d.getDate()+3-((d.getDay()+6)%7));const w1=new Date(d.getFullYear(),0,4);const n=1+Math.round(((d-w1)/DAY-3+((w1.getDay()+6)%7))/7);return d.getFullYear()+'-W'+String(n).padStart(2,'0')}
const weekNum=()=>+weekKey().split('W')[1];
function ago(t){const s=(now()-t)/1000;if(s<60)return 'just now';if(s<3600)return Math.floor(s/60)+' min ago';if(s<86400)return Math.floor(s/3600)+' h ago';const d=Math.floor(s/86400);return d===1?'yesterday':d+' days ago'}
function left(ms){if(ms<=0)return '0:00';const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;if(d)return d+'d '+h+'h';if(h)return h+'h '+String(m).padStart(2,'0')+'m';return m+':'+String(x).padStart(2,'0')}
const DOW=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function when(t){const d=new Date(t),td=dayStart(now()),dd=dayStart(t);const hm=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});if(dd===td)return 'Today '+hm;if(dd===td+DAY)return 'Tomorrow '+hm;if(dd===td-DAY)return 'Yesterday '+hm;return DOW[d.getDay()]+' '+d.getDate()+' '+d.toLocaleString([],{month:'short'})+', '+hm}
const ordinal=n=>n+(['th','st','nd','rd'][(n%100-20)%10]||['th','st','nd','rd'][n%100]||'th');

// C20: cut to n UTF-16 units, whole graphemes only (emoji, Tamil, Arabic), at a word when one is in the second half. Same rule as server/text.js.
const SEG=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter():null;
function clip(s,n){s=String(s??'').trim();if(s.length<=n)return s;let o='';for(const c of SEG?Array.from(SEG.segment(s),x=>x.segment):Array.from(s)){if(o.length+c.length>n)break;o+=c}const w=o.lastIndexOf(' ');return (w>n/2&&!/\s/.test(s[o.length])?o.slice(0,w):o).trim()}
