/* ---------- Decode: one city puzzle a week ---------- */
const CLUES=[
 {q:'Shift every letter back three places in the alphabet: ZDWHUORR',h:['It’s on maps, and on a famous song list.','D becomes A, E becomes B, A becomes X.','Napoleon would rather not talk about it.'],a:'d891582a'},
 {q:'Take the first letters: Mangoes Always Ripen Kindly Every Tuesday.',h:['It’s a place, not a fruit.','Six letters. Stalls, not shelves.','Farmers’ ___.'],a:'b33f86f1'},
 {q:'Change one letter at a time: COLD → ? → ? → WARD → WARM. What’s the third word?',h:['The second word is CORD.','Change the O next.','You play it, deal it, or pay with it.'],a:'857abc9f'},
 {q:'A=1, B=2 … Z=26. Decode: 13 · 21 · 19 · 5 · 21 · 13',h:['Six letters, starts and ends the same.','13 is M.','Free on Sundays in a lot of cities.'],a:'b0d0bc95'},
 {q:'A place is hiding in this line: “the cab ridge road”.',h:['Ignore the spaces.','It crosses something.','Six letters, starts with B.'],a:'bac85190'},
 {q:'Old phone keypad: 7 · 8 · 2 · 8 · 4 · 6 · 6',h:['2 is ABC, 7 is PQRS.','It starts with S.','Trains stop here.'],a:'41d62ef3'},
 {q:'Rearrange DANGER into somewhere things grow.',h:['Six letters.','It starts with G.','Sheds and allotments.'],a:'19bded74'},
 {q:'Morse code: - --- .-- . .-.',h:['A dash is a long beep. - is T.','Five letters.','London has a famous one with ravens.'],a:'37d4eb02'}];
const ANS=['WATERLOO','MARKET','CARD','MUSEUM','BRIDGE','STATION','GARDEN','TOWER'];
const HINT_AT=[3,8,15],HINT_DAY=[1,3,5];
const clueIdx=()=>weekNum()%CLUES.length;
function decodeState(solves){
  const ws=weekStart(),n=solves.length,t=now();
  const hints=HINT_AT.map((k,i)=>n>=k||t>=ws+HINT_DAY[i]*DAY);
  const reveal=Math.max(ws+4*DAY,ws+7*DAY-Math.min(n,24)*3*HOUR);
  return {n,hints,nh:hints.filter(Boolean).length,reveal,revealed:t>=reveal};
}
const decPts=(rank,nh)=>Math.max(5,Math.max(10,100-8*(rank-1))-15*nh);

