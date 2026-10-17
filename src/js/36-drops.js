/* ---------- drops ---------- */
const DK={
 offer:{n:'Shop offer',s:'OFR',d:'Everyone who turns up in the hour gets the offer. One circle is drawn for the bigger prize.'},
 cash:{n:'Cash draw',s:'£',d:'A sponsor puts up the cash. It’s drawn among circles that turned up and split inside the winning circle. Free to enter, always.'},
 swap:{n:'Swap box',s:'SWP',d:'Bring something, take what’s in the box. The box keeps a log of every swap.'},
 twokey:{n:'Two-key',s:'2K',d:'Opens only when two different circles check in during the hour. Then everyone there gets the prize.'},
 dare:{n:'Counter dare',s:'DAR',d:'Do the dare at the counter, then check in with the door code to get the prize.'}};
function dropPhase(d,t=now()){return t<d.start?'soon':t<d.end?'open':'over'}
function drawWinner(d,ins){const cs=[...new Set(ins.map(i=>i.circle).filter(Boolean))].sort();if(!cs.length)return null;return cs[fnvN(d.id+'|'+cs.join(','))%cs.length]}

