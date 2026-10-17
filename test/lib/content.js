// What a test needs to know about the content packs (WS-E): every answer, and this week's answer in
// local mode (the same schedule the page runs, from server/content-core.js). The page itself never has it.
'use strict';
const path = require('path');
const C = require('../../server/content-core');
const P = require('../../server/content/puzzles.json');
const allAnswers = () => [...new Set(P.packs.flatMap(p => p.puzzles.map(z => z.a)))];
function localPuzzle(city, week) { const pk = C.packFor(P.packs, city); return pk.puzzles[C.permAt(pk.puzzles.length, 'decode|' + city, C.isoWeekIdx(week))]; }
const localAnswer = (city, week) => localPuzzle(city, week).a;
module.exports = { C, P, allAnswers, localPuzzle, localAnswer, DIR: path.join(__dirname, '..', '..', 'server', 'content') };
