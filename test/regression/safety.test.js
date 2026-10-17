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
  // int-1: the owner's 24 h undo of a removal used v0.8's rule (back only if they are in no circle now), so with
  // multi-circle a member of a second circle never came back. Now: back if they have room for one more circle and
  // this one isn't full; their other circle and their primary are kept. At MAX_CIRCLES the undo only lets them rejoin.
  { I.reset();
    const o = I.person('Owner'), x = I.person('Ex'), o2 = I.person('Other owner'), o3 = I.person('Third owner');
    const { cid } = I.circle(o), c2 = I.circle(o2, 'Second').cid, c3 = I.circle(o3, 'Third').cid;
    const add = (u, c) => { const p = I.S.getDoc('people/' + u.uid); I.wr('update', 'people/' + u.uid, { circles: [...(p.circles || []), c] }, u); I.wr('update', 'circles/' + c, { members: [...new Set([...(I.S.getDoc('circles/' + c).members || []), u.uid])] }, u); };
    I.join(x, c2); add(x, cid);
    const before = I.S.getDoc('people/' + x.uid);
    t.ok('R-unremove setup: Ex is in Second (primary) and Third Floor', before.circle === c2 && JSON.stringify(before.circles) === JSON.stringify([c2, cid]), JSON.stringify(before));
    I.route('circle/remove', { cid, uid: x.uid }, o);
    const r = I.route('circle/unremove', { cid, uid: x.uid }, o), p = I.S.getDoc('people/' + x.uid);
    t.ok('R-unremove undo brings back someone who is still in another circle', r.ok && r.back === true && I.S.getDoc('circles/' + cid).members.includes(x.uid) && !!I.get(`circles/${cid}/threads/general`, x).doc, JSON.stringify(r));
    t.ok('R-unremove … keeping their other circle and their primary', p.circle === c2 && JSON.stringify(p.circles) === JSON.stringify([c2, cid]) && I.S.getDoc('circles/' + c2).members.includes(x.uid), JSON.stringify(p));
    // Removed from Third Floor, then joins Third: 2 of 3 circles, so the undo still has room.
    I.route('circle/remove', { cid, uid: x.uid }, o); add(x, c3); const y = I.person('Spare'); add(y, cid);
    const r2 = I.route('circle/unremove', { cid, uid: x.uid }, o), p2 = I.S.getDoc('people/' + x.uid);
    t.ok('R-unremove with room for one more (2 of 3 circles) still brings them back, as their third', r2.ok && r2.back === true && JSON.stringify(p2.circles) === JSON.stringify([c2, c3, cid]) && p2.circle === c2, JSON.stringify([r2, p2.circles]));
    const z = I.person('Zed'), za = I.circle(I.person('A'), 'A').cid, zb = I.circle(I.person('B'), 'B').cid; I.join(z, za); add(z, cid);
    I.route('circle/remove', { cid, uid: z.uid }, o); add(z, zb); // now in A and B: 2 circles, room for a 3rd
    const zc = I.circle(I.person('C'), 'C').cid; add(z, zc); // 3 circles: at the cap
    const r3 = I.route('circle/unremove', { cid, uid: z.uid }, o), pz = I.S.getDoc('people/' + z.uid);
    t.ok('R-unremove at MAX_CIRCLES the undo doesn’t add a 4th circle; the removal is cleared so they can rejoin later', r3.ok && r3.back === false && pz.circles.length === 3 && !pz.circles.includes(cid) && !(I.S.getDoc('circles/' + cid).removed || {})[z.uid], JSON.stringify([r3, pz.circles]));
    t.ok('R-unremove someone who is in no circle comes back as before (primary)', (() => { const w = I.person('Wren'); I.join(w, cid); I.route('circle/remove', { cid, uid: w.uid }, o); const rr = I.route('circle/unremove', { cid, uid: w.uid }, o), pw = I.S.getDoc('people/' + w.uid); return rr.back === true && pw.circle === cid && JSON.stringify(pw.circles) === JSON.stringify([cid]); })()); }
};
