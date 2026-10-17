# INSANE

**When money stops meaning anything, people become the currency.**

A concept for a post-money barter-and-dare app. Swap stuff in multi-person loops, pay with dares your friends film and rank on insanity, and carry a ledger of favors.

## What's here

| Path | What it is |
|---|---|
| [`app/index.html`](app/index.html) | **v0.8, the working app**, with v0.6's flow back: Home · Circle · + · City · Ledger. Places anywhere on Earth (exact private pin or a 1–9 km² square), favors in hours, pots with who's paid, the daily dare and jar, 24-hour photo clips, cheers, the Mole, Missions with a hidden spot, trails stamped by GPS, plus everything from v0.7. Runs inside claude.ai (shared store) or on the INSANE server. Seven-person browser test in [`app/test/e2e.js`](app/test/e2e.js) |
| [`server/server.js`](server/server.js) | The INSANE server: email sign-in, live sync, OpenStreetMap tiles and search, web push, and the checks a page can't be trusted with. Node 22, no dependencies. Two-week, eleven-person playtest in [`server/test/playtest.js`](server/test/playtest.js) |
| [`app/data/`](app/data) | Bundled world map and 69,818 places, built from Natural Earth and GeoNames by [`tools/build_geo.py`](tools/build_geo.py) |
| [`docs/PLAN-V09.md`](docs/PLAN-V09.md) | **v0.9 plan (branch `v0.9`, planning only):** 108 critiques from a live test on Pixel 7 / iPhone 13 ([`docs/CRITIQUES-V09.md`](docs/CRITIQUES-V09.md), screenshots in [`docs/v09-shots/`](docs/v09-shots)), workstreams, and the test plan (e2e, property-based, differential, golden) |
| [`docs/V08.md`](docs/V08.md) | v0.8: why v0.6's features went missing and what's back, real location, the server, simulator vs playtest, findings, what's still not built |
| [`docs/PLAYTEST.md`](docs/PLAYTEST.md) | The two-week playtest diary, timings and all 92 checks, with screenshots in [`docs/playtest/`](docs/playtest) |
| [`prototype/index.html`](prototype/index.html) | **v0.6.** Onboarding ends with needs, wants and urges in your own words. Adds chat in threads, rooms with other circles, a City feed without counts, Decode nights, drops per zone, trails, Go dark and sealed messages. Console: v0.6 tested, v0.5 tested, the road to 90%, what to build next, your ideas tested, the simulator, and a week on v0.6 |
| [`prototype/v5/index.html`](prototype/v5/index.html) | v0.5: the first five minutes, Pacts, Midnight, the Mole, the Wall and Calls |
| [`prototype/v4/index.html`](prototype/v4/index.html) | v0.4: Pots, Chapters and Missions on top of v0.3 |
| [`prototype/v3/index.html`](prototype/v3/index.html) | v0.3: the city is the board, with Zones, Hunts, Drops, the League and the ledger as money |
| [`prototype/v2/index.html`](prototype/v2/index.html) | v0.2: circles, Daily Dare, favor board, weekly Market Day, with the 30-day diary and calibrated simulator |
| [`prototype/v1/index.html`](prototype/v1/index.html) | v0.1, the original prototype |
| [`docs/BUILD.md`](docs/BUILD.md) | v0.7: the deeper prompt applied to finishing the app, needs vs wants vs urges, what drops should be instead of auctions or proximity reveals, feasibility of every feature on a phone, the test results, and pass/fail numbers for a real two-week test |
| [`docs/V06.md`](docs/V06.md) | v0.6: Vanish as an app lock, needs/wants/urges, Decode and anti-lazy rules, sponsors vs auctions, 16 kinds of city play ranked, chat design, a public feed, sealed messages, and whether the phone scan can be faked, all simulated |
| [`docs/V05.md`](docs/V05.md) | v0.5: the structure, why not WhatsApp, the reason to persist, fake Missions, Midnight, the Mole, favors in hours, AI fakes, and the flow, all simulated |
| [`docs/V04.md`](docs/V04.md) | What v0.4 builds: Pots, Chapters and Missions, with their rules |
| [`docs/IMPACT.md`](docs/IMPACT.md) | Every OPTIONS.md idea simulated: what to build next, what to skip, and why fewer features win |
| [`docs/OPTIONS.md`](docs/OPTIONS.md) | Pooling money and compliance options, whether swapping is legal, and the Fight Club layer |
| [`docs/V03.md`](docs/V03.md) | What it would take to get from 23% to 90%, and what v0.3 adds |
| [`docs/DIARY.md`](docs/DIARY.md) | 30 days as a real user on v0.1 and v0.2, plus a real-world test plan |
| [`docs/DEEPER.md`](docs/DEEPER.md) | The "deeper, not bigger" method, the rewritten prompt, and sources |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design bible: thesis, currencies, loops, guardrails, v0.2 changes |

## Run it

Open `prototype/index.html` for the prototype and research console. The app's source is in `src/`; `npm run build` writes the single-file `app/index.html` (committed, pasteable into claude.ai), and `npm run check` fails if it's stale. See [`docs/WS0.md`](docs/WS0.md).

The app runs three ways:
- **Inside claude.ai** as a published artifact (shared live with everyone invited).
- **On the INSANE server:** `DEV=1 OWNER_EMAIL=you@example.com node server/server.js`, then open http://localhost:8080. Sign-in codes print to the log; set `RESEND_API_KEY`, `MAIL_FROM` and `PUBLIC_URL` to send real email.
- **As a one-device demo** from any static server.

Tests: `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i` once (playwright-core, uses the system Chromium or `CHROMIUM=`), then `npm test`: build check, unit, property-based, v0.8-vs-v0.9 differential, the 83 local-store and 92 server checks against the built file, and golden screens. `npm run test:quick` skips the browser suites.

## The short version

Using v0.1 every day for a month showed it doesn't die of addiction. It dies of loneliness (two friends is not a network), frequency (nobody has something to swap every day) and logistics (three separate handoffs always fail).

v0.2 fixes that with:
- **Circles** of friends, with the Market unlocking at four members
- a **Daily Dare**: one 15-second prompt per circle
- a **favor board** for small services
- one weekly **Market Day** where every handoff happens at one table
- IOUs that stay inside the circle, a credit limit, and no free credits

Before it compares designs, the simulator has to match published social-app retention and reproduce two real barter-currency collapses: Argentina's trueque clubs in 2002 and Bunz's BTZ in 2019. Once it passes, it puts v0.2 at about 23% day-30 retention against about 9% for v0.1, with the caveat that 23% is above the published range.

**v0.3:** to get toward 90%, the app has to become infrastructure, not just entertainment. The ledger becomes the circle's everyday money and the League gives every circle a weekly fixture. Zones (camera-equipped venues with staff, where the insanity ceiling rises), circle-built Hunts and real-item Drops give the app its name. The model puts v0.3 at about 58% day-30 retention and about 96% "month one" (a loose measure; a plain app scores 39% on it). Cash drops and removing the insanity ceiling are the two ways to sink it.

**What to build next:** every idea in OPTIONS.md was simulated on top of v0.3, adding one at a time on paired seeds. The best are pledge-then-pay Pots, Chapters and Missions (together about +10 points of day 30). Homework, time-based favors and Duels are cheap additions. Favor cash-out is the only idea that loses users, and shipping all ten safe ideas falls apart once each feature costs users a little attention. See [`docs/IMPACT.md`](docs/IMPACT.md).

**v0.4** builds those three. Pots never hold money: the app tracks who's in and who's paid, and people pay each other or the shop directly. Chapters are invite-only, cross-circle clubs whose videos vanish after 24 hours, and you put your Reliability on everyone you vouch for. Missions are monthly stunts with no victims; you see the area, and the exact spot is revealed two hours before. See [`docs/V04.md`](docs/V04.md).

**v0.5** asks what keeps people opening an app whose best moments are rare. The answer is **Pacts**: goals your circle checks in on, with two free misses a week (+8.6 points of day 30 on top of v0.4). Next is **the Mole**, one secret saboteur per circle each week (+6.0). **Midnight** releases unsigned messages about yourself together at midnight; gossip about other people hurts five times as many people for almost no gain. Fake Missions are stopped by a Reliability stake and meeting in person, not by money escrow. The flow matters as much as the features: shown all at once, the new ideas fall below v0.4 once each concept costs people attention, so the phone now has four tabs, one + button, and unlocks things over two weeks. See [`docs/V05.md`](docs/V05.md).

**v0.6** builds the things people asked for, the quiet way. Chat lives in threads on plans, pots and pacts: one busy room for the whole circle *loses* about 6 points, while threads add up to 3. The City feed has no like counts, no follower counts and no stranger comments; that was the best idea of the round, while the open version hurt about 220 people. Decode nights give points by solve order and draw the prize among everyone who turns up, because whenever arriving first wins, everyone rushes. Drops go one per zone, sponsored by shops but never auctioned. Go dark covers your noisy apps for up to a day; no app can blank the whole phone. Onboarding ends with what you need, want or have an urge to do, in your own words. See [`docs/V06.md`](docs/V06.md).

**v0.8** makes the working app real end to end and brings v0.6's game back into it. Places work anywhere on Earth: you choose an exact pin that only you can read, or a 1, 4 or 9 km² square, plus how far you'd go for a drop. The INSANE server adds email sign-in, street maps, GPS, push and server-side checks. The five-tab layout returns with the + button, alongside the Ledger (favors in hours with a −5 h limit, pots with who's paid), the daily dare and jar, photo clips that vanish in 24 hours, cheers, the Mole, Missions whose exact spot stays hidden until two hours before, and trails stamped by GPS. A two-week playtest with eleven people in four cities passes 92 of 92 checks. See [`docs/V08.md`](docs/V08.md).

**v0.7** is the working app, separate from the prototype. You sign in with your account, and everything is shared live with the people you invite. Each person's journeys and timeline are private by storage rule, and Midnight messages are saved with no author. Drops are hosted by shops, stalls and circles: swap boxes, two-key drops that only open when two circles arrive together, counter dares, shop offers and free cash draws. The draw can be checked by anyone. Map tiles, GPS, QR and Bluetooth, push notifications and Screen Time need the phone app; the app labels each stand-in on screen. A five-person browser test passes 41 of 41 checks. See [`docs/BUILD.md`](docs/BUILD.md).
