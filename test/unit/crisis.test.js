// int-1 (WS-J groundwork): the Support read card names a crisis line people where the phone is can call.
// India's Tele-MANAS (14416) by default; the UK's Samaritans (116 123) only on a GB locale, as v0.8 showed.
'use strict';
const { loadV09 } = require('../lib/load');
module.exports = async function (t) {
  const app = loadV09();
  const card = lang => { app.run(`navigator.language = ${JSON.stringify(lang)}`); return app.get('readCard')(app.get('readUrge')('urge', 'hurt myself')); };
  const inC = card('en-IN'), gb = card('en-GB'), us = card('en-US');
  t.ok('the Support card is what "hurt myself" reads as', /needs a person/.test(inC), inC.slice(0, 120));
  t.ok('en-IN: Tele-MANAS 14416, no UK number', inC.includes('14416') && !inC.includes('116 123'), inC);
  t.ok('en-GB: Samaritans 116 123 (v0.8’s line)', gb.includes('116 123') && !gb.includes('14416'), gb);
  t.ok('any other locale: Tele-MANAS, plus findahelpline.com', us.includes('14416') && us.includes('findahelpline.com'), us);
  app.run(`navigator.language = 'en-GB'`);
};
