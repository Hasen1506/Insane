// WS-D regressions, one per bug from the live test (PLAN-V09 §5.e), against the real server rules in process.
'use strict';
const I = require('../lib/inproc');
module.exports = async function (t) {
  // R-C37: Arjun queued “Kavya, you are the funniest person here” and it went through, because Kavya's stored
  // name is “كافيا Kavya” and only the full name was checked, in the page.
  I.reset();
  const arjun = I.person('Arjun'), kavya = I.person('كافيا Kavya'), ravi = I.person('Ravi');
  const { cid } = I.circle(arjun); I.join(kavya, cid); I.join(ravi, cid);
  const r = I.wr('set', `circles/${cid}/midnight/m1`, { text: 'Kavya, you are the funniest person here', releaseAt: 0 }, arjun);
  t.ok('R-C37 “Kavya” is refused by the server when the member’s name is “كافيا Kavya”', r.reason === 'names_blocked' && !I.S.getDoc(`circles/${cid}/midnight/m1`), JSON.stringify(r));
  t.ok('R-C37 … and the Arabic half too', I.wr('set', `circles/${cid}/midnight/m2`, { text: 'شكرا كافيا', releaseAt: 0 }, arjun).reason === 'names_blocked');
  const app = require('../lib/load').loadV09();
  t.ok('R-C37 the page refuses it before sending', !!app.get('NAMES').nameHit('Kavya, you are the funniest person here', [{ name: 'كافيا Kavya' }]));
  t.ok('R-C37 a message about yourself still goes', I.wr('set', `circles/${cid}/midnight/m3`, { text: 'I, Arjun, cried at a car advert', releaseAt: 0 }, arjun).ok);

  // C63/C17: a sign-up without the age attestation or the current consent is refused, whatever the page sends.
  { const u = I.user(), base = { name: 'Nobody', circle: null };
    const r1 = I.wr('set', 'people/' + u.uid, base, u), r2 = I.wr('set', 'people/' + u.uid, { ...base, adult: true }, u), r3 = I.wr('set', 'people/' + u.uid, { ...base, adult: true, consent: { v: '2020-old' } }, u);
    const r4 = I.wr('set', 'people/' + u.uid, { ...base, adult: true, consent: { v: I.CONSENT, at: 1 } }, u), d = I.S.getDoc('people/' + u.uid);
    t.ok('C63 sign-up needs the age attestation and the current consent; the server stamps the time itself', !r1.ok && !r2.ok && !r3.ok && r4.ok && d.consent.v === I.CONSENT && d.consent.at > 1 && d.adultAt > 0, JSON.stringify([r1, r2, r3, r4].map(r => r.code || 'ok')));
    I.wr('update', 'people/' + u.uid, { consent: { v: 'forged', at: 5 }, adult: false }, u);
    t.ok('C63 the consent record can’t be rewritten by the page', I.S.getDoc('people/' + u.uid).consent.v === I.CONSENT && I.S.getDoc('people/' + u.uid).adult === true); }

  // R-C59: “Delete for good” left Ravi signed in, then dropped him into onboarding: the account, session and
  // OTP rows stayed, and the deletes were a loop in the page.
  const del = await I.route('account/delete', { confirm: 'DELETE' }, ravi);
  t.ok('R-C59 delete clears the session cookie', del.ok && /Max-Age=0/.test(del.headers['set-cookie']), JSON.stringify(del));
  t.ok('R-C59 the session and account rows are gone, so the next request is signed out', !I.S.db.prepare('SELECT 1 FROM sessions WHERE uid=?').get(ravi.uid) && !I.S.db.prepare('SELECT 1 FROM users WHERE uid=?').get(ravi.uid) && !I.S.userById(ravi.uid));
  t.ok('R-C59 the profile is gone and the circle no longer lists him', !I.S.getDoc('people/' + ravi.uid) && !I.S.getDoc('circles/' + cid).members.includes(ravi.uid));
};
