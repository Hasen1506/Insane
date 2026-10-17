#!/usr/bin/env node
// Writes server/content/puzzles.json from the table below (WS-E, C91). Run it after editing the table:
//   node tools/content/make-puzzles.js
// Each row is [answer, kind, what-it-is (hint 3), text-or-shift]. The clue and the first two hints are
// written from the kind, so every clue shows exactly the data the checker (server/content-core.js) solves.
// The owner content tool (/admin/content) adds and edits puzzles at run time; this file is the seed.
'use strict';
const fs = require('fs'), path = require('path');
const C = require('../../server/content-core');
const OUT = path.join(__dirname, '..', '..', 'server', 'content', 'puzzles.json');

const PACKS = [
  { id: 'chennai', name: 'Chennai', cities: ['IN-tamil_nadu-chennai', 'IN-tamil_nadu-avadi', 'IN-tamil_nadu-tambaram', 'IN-tamil_nadu-ambattur', 'IN-tamil_nadu-tiruvottiyur'], rows: [
    ['MARINA', 'caesar', 'One of the longest city beaches in the world, with the lighthouse at one end.', 3],
    ['MYLAPORE', 'a1z26', 'The old neighbourhood around the Kapaleeshwarar Temple tank.'],
    ['ADYAR', 'hidden', 'A river, its estuary, and the great banyan tree by the Theosophical Society.', 'Please read yarn labels before you knit.'],
    ['GUINDY', 'keypad', 'A national park with blackbucks, right inside the city.'],
    ['EGMORE', 'morse', 'A railway station for trains heading south, near the Government Museum.'],
    ['SANTHOME', 'reverse', 'A white basilica by the sea, on the road between the beach and Mylapore.'],
    ['KOYAMBEDU', 'atbash', 'The big wholesale market for fruit, vegetables and flowers, and the bus terminus.'],
    ['KOLAM', 'acrostic', 'Drawn in rice flour at the doorstep, early every morning.', 'Keep Old Lamps Always Mended.'],
    ['MARGAZHI', 'zip', 'The Tamil month of the December music and dance season.'],
    ['SUNDAL', 'hidden', 'Spiced chickpeas sold in paper cones on the beach in the evening.', 'Lunch on the terrace was sun, dal and rice.'],
    ['PONGAL', 'anagram', 'A harvest festival in January, and the dish cooked for it.'],
    ['KAAPI', 'lastletters', 'Filter, frothy, poured from a height between a tumbler and a dabarah.', 'Walk, sofa, idea, sip, taxi.'],
  ] },
  { id: 'bengaluru', name: 'Bengaluru', cities: ['IN-karnataka-bengaluru', 'IN-karnataka-bangalore'], rows: [
    ['LALBAGH', 'caesar', 'The botanical garden with a glass house and a flower show twice a year.', 5],
    ['CUBBON', 'a1z26', 'The big green park around the State Central Library and the High Court.'],
    ['MALLESWARAM', 'atbash', 'An old neighbourhood of temples, flower stalls and its own famous dosa.'],
    ['JAYANAGAR', 'keypad', 'A planned southern neighbourhood with a shopping complex called 4th Block.'],
    ['KORAMANGALA', 'zip', 'Start-ups, cafés and its own Blocks 1 to 8.'],
    ['BASAVANAGUDI', 'reverse', 'Home of the Bull Temple and the yearly groundnut fair.'],
    ['NANDI', 'acrostic', 'The hills north of the city where people drive to watch the sunrise.', 'Never Again Nap During Interviews.'],
    ['ULSOOR', 'morse', 'A lake near MG Road with small islands and boats.'],
    ['VIDHANA', 'anagram', 'The first word of the granite seat of the state legislature.'],
    ['INDIRANAGAR', 'caesar', 'The 100 Feet Road neighbourhood of pubs and shops, east of the centre.', 7],
    ['KARAGA', 'lastletters', 'A night-time festival procession that starts at the Dharmaraya Temple.', 'Book, sofa, star, pizza, dog, tea.'],
    ['BENNE', 'hidden', 'The Kannada word for butter, as in the crisp dosa from Davangere.', 'Tell Ben next time, not now.'],
  ] },
  { id: 'mumbai', name: 'Mumbai', cities: ['IN-maharashtra-mumbai', 'IN-maharashtra-thane', 'IN-maharashtra-navi_mumbai', 'IN-maharashtra-kalyan'], rows: [
    ['COLABA', 'caesar', 'The southern tip: a causeway market and the café everyone has heard of.', 4],
    ['BANDRA', 'hidden', 'The Queen of the Suburbs, with a sea link and a bandstand.', 'Urban drama at the station again.'],
    ['JUHU', 'keypad', 'A long suburban beach known for its street food stalls.'],
    ['DADAR', 'a1z26', 'A junction station and a flower market, in the middle of the city.'],
    ['WORLI', 'hidden', 'A sea face, a fort and the southern end of the sea link.', 'Throw or lift the bag, but don’t drag it.'],
    ['CHOWPATTY', 'morse', 'The beach at the end of Marine Drive, famous for bhel puri.'],
    ['VADAPAV', 'reverse', 'A potato fritter in a soft bun: the city’s own snack.'],
    ['DABBAWALA', 'atbash', 'The people who carry lunch boxes across the city by train, with almost no mistakes.'],
    ['ELEPHANTA', 'zip', 'An island of rock-cut caves, a ferry ride from the Gateway.'],
    ['BYCULLA', 'anagram', 'The neighbourhood of the zoo and the old museum garden.'],
    ['GATEWAY', 'acrostic', 'The basalt arch on the harbour, built for a royal visit.', 'Go And Take Every Wave As Yours.'],
    ['MAHIM', 'lastletters', 'A bay, a causeway and a famous dargah on the western line.', 'Film, pizza, fish, taxi, room.'],
  ] },
  { id: 'delhi', name: 'Delhi', cities: ['IN-delhi-delhi', 'IN-delhi-new_delhi', 'IN-delhi-najafgarh', 'IN-uttar_pradesh-noida', 'IN-uttar_pradesh-ghaziabad', 'IN-haryana-gurgaon', 'IN-haryana-gurugram', 'IN-haryana-faridabad'], rows: [
    ['CHANDNI', 'caesar', 'The first word of Old Delhi’s busiest market street.', 6],
    ['QUTUB', 'a1z26', 'The tall fluted minar of red sandstone, in Mehrauli.'],
    ['LODHI', 'keypad', 'Gardens of old tombs, walkers and street art nearby.'],
    ['HAUZKHAS', 'reverse', 'A village, a lake and a ruined madrasa, now full of cafés.'],
    ['KARTAVYA', 'atbash', 'The new name of the ceremonial avenue to India Gate.'],
    ['JANPATH', 'acrostic', 'A market street of stalls just off Connaught Place.', 'Just Ask Nani, People Always Trust Her.'],
    ['PARATHA', 'zip', 'Stuffed flatbread, fried in a famous lane of Chandni Chowk.'],
    ['LOTUS', 'hidden', 'A temple shaped like a flower, open to people of every faith.', 'They promised to allot us two seats.'],
    ['CONNAUGHT', 'morse', 'The white colonnaded rings at the centre of New Delhi.'],
    ['PURANAQILA', 'anagram', 'The Old Fort, by the zoo, with a lake for boating.'],
    ['CHOLE', 'lastletters', 'Spiced chickpeas, best with bhature.', 'Music, much, radio, ball, cake.'],
    ['YAMUNA', 'caesar', 'The river that runs past the Red Fort.', 9],
  ] },
  { id: 'hyderabad', name: 'Hyderabad', cities: ['IN-telangana-hyderabad', 'IN-telangana-secunderabad'], rows: [
    ['CHARMINAR', 'caesar', 'The four-minaret monument at the heart of the old city.', 3],
    ['BIRYANI', 'a1z26', 'Rice and meat cooked slowly, sealed with dough: the city’s pride.'],
    ['GOLCONDA', 'atbash', 'A hilltop fort where a clap at the gate is heard at the top.'],
    ['HUSSAINSAGAR', 'zip', 'The lake with a giant Buddha statue standing in it.'],
    ['IRANI', 'hidden', 'The cafés of chai and Osmania biscuits.', 'Hari ran in from the rain.'],
    ['HALEEM', 'keypad', 'A slow-cooked dish of wheat, lentils and meat, made in Ramzan.'],
  ] },
  { id: 'kolkata', name: 'Kolkata', cities: ['IN-west_bengal-kolkata', 'IN-west_bengal-howrah'], rows: [
    ['HOWRAH', 'hidden', 'The cantilever bridge over the river, and the station at its end.', 'Please show Rahul the way to the ferry.'],
    ['VICTORIA', 'caesar', 'A white marble memorial with gardens on the Maidan.', 4],
    ['RASGULLA', 'reverse', 'A soft spongy sweet in syrup.'],
    ['KUMARTULI', 'atbash', 'The potters’ quarter where the clay idols for Durga Puja are made.'],
    ['PHUCHKA', 'morse', 'What the rest of India calls pani puri.'],
    ['HOOGHLY', 'a1z26', 'The river the city stands on.'],
  ] },
  { id: 'generic', name: 'Anywhere', cities: [], rows: [
    ['MARKET', 'acrostic', 'Stalls, not shelves. Farmers’ ___.', 'Mangoes Always Ripen Kindly Every Tuesday.'],
    ['MUSEUM', 'a1z26', 'Free on Sundays in a lot of cities.'],
    ['BRIDGE', 'hidden', 'It crosses something.', 'Meet me on the cab ridge road.'],
    ['STATION', 'keypad', 'Trains stop here.'],
    ['GARDEN', 'anagram', 'Sheds, beds and allotments.', 'DANGER'],
    ['LIBRARY', 'caesar', 'Borrow, read, bring it back.', 3],
    ['BAKERY', 'morse', 'Where the bread comes from at six in the morning.'],
    ['HARBOUR', 'atbash', 'Boats tie up here.'],
    ['FOUNTAIN', 'zip', 'Water thrown up in a square for no reason but joy.'],
    ['LIGHTHOUSE', 'reverse', 'A tall tower by the sea that blinks all night.'],
    ['PLAYGROUND', 'caesar', 'Swings and slides.', 5],
    ['BANDSTAND', 'lastletters', 'A round roof in a park where a band plays on Sundays.', 'Club, sofa, sun, red, bus, cat, pizza, fan, bread.'],
  ] },
];

const FILL = 'TQXVZJKWYPFBTQXVZJKW';
const HOW = {
  caesar: (a, d) => `Count back ${d.shift}: ${d.text[0]} becomes ${a[0]}.`,
  atbash: (a, d) => `${d.text[0]} becomes ${a[0]}, and M and N swap places.`,
  a1z26: (a, d) => `${d.nums[0]} is ${a[0]}.`,
  morse: (a, d) => `A dot is a short beep, a dash a long one. ${d.code.split(' ')[0]} is ${a[0]}.`,
  reverse: () => 'Start from the last letter and read left.',
  acrostic: () => 'Just the first letter of each word, in order.',
  lastletters: () => 'Only the final letter of each word counts.',
  zip: () => 'Skip the second, fourth, sixth… letters.',
  anagram: () => 'Every letter is used exactly once.',
  keypad: () => '2 is ABC, 7 is PQRS, 9 is WXYZ.',
  hidden: () => 'Ignore the spaces and punctuation.',
};
const GIVES_FIRST = new Set(['caesar', 'atbash', 'a1z26', 'morse']);
function data(a, kind, extra) {
  switch (kind) {
    case 'caesar': return { shift: extra, text: C.shift(a, extra) };
    case 'atbash': return { text: C.atbash(a) };
    case 'a1z26': return { nums: a.split('').map(c => c.charCodeAt(0) - 64) };
    case 'morse': return { code: a.split('').map(c => C.MORSE[c]).join(' ') };
    case 'reverse': return { text: a.split('').reverse().join('') };
    case 'keypad': return { digits: a.split('').map(C.keyOf).join('') };
    case 'zip': return { text: a.split('').map((c, i) => c + (i < a.length - 1 ? FILL[(i + a.length) % FILL.length] : '')).join('') };
    case 'anagram': { if (extra) return { letters: extra }; const p = C.seededPerm(a.length, 'anagram|' + a); let s = p.map(i => a[i]).join(''); if (s === a) s = a.slice(1) + a[0]; return { letters: s }; }
    default: return { text: extra }; // acrostic, lastletters, hidden: written by hand
  }
}
const slug = s => s.toLowerCase();
const out = { version: 1, note: 'Generated by tools/content/make-puzzles.js. Each puzzle is solvable from its data (server/content-core.js checkPuzzle). Answers never leave the server in server mode.', packs: [] };
for (const p of PACKS) {
  const puzzles = p.rows.map(([a, kind, what, extra]) => {
    const d = data(a, kind, extra);
    const h2 = GIVES_FIRST.has(kind) ? `${a.length} letters; the last one is ${a[a.length - 1]}.` : `${a.length} letters, starting with ${a[0]}.`;
    const pz = { id: p.id + '-' + slug(a), kind, data: d, q: C.ASK[kind](d), h: [HOW[kind](a, d), h2, what], a };
    const bad = C.checkPuzzle(pz); if (bad.length) throw new Error(pz.id + ': ' + bad.join('; '));
    return pz;
  });
  out.packs.push({ id: p.id, name: p.name, cities: p.cities, puzzles });
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log('wrote', path.relative(process.cwd(), OUT), out.packs.map(p => p.id + ':' + p.puzzles.length).join(' '), '=', out.packs.reduce((n, p) => n + p.puzzles.length, 0));
