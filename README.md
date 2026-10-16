# INSANE

**When money stops meaning anything, people become the currency.**

A concept for a post-money barter-and-dare app. Swap stuff in multi-person loops, pay with dares your friends film and rank on insanity, and carry a ledger of favors.

## What's here

| Path | What it is |
|---|---|
| [`prototype/index.html`](prototype/index.html) | **v0.5.** Opens on the first five minutes (invite, handle, in-person scan, first pact), then Home · Circle · + · City · Ledger, with Pacts, Midnight, the Mole, the Wall and Calls. Console: v0.5 tested, the road to 90%, what to build next, your ideas tested, the simulator, and a week on v0.5 |
| [`prototype/v4/index.html`](prototype/v4/index.html) | v0.4: Pots, Chapters and Missions on top of v0.3 |
| [`prototype/v3/index.html`](prototype/v3/index.html) | v0.3: the city is the board, with Zones, Hunts, Drops, the League and the ledger as money |
| [`prototype/v2/index.html`](prototype/v2/index.html) | v0.2: circles, Daily Dare, favor board, weekly Market Day, with the 30-day diary and calibrated simulator |
| [`prototype/v1/index.html`](prototype/v1/index.html) | v0.1, the original prototype |
| [`docs/V05.md`](docs/V05.md) | v0.5: the structure, why not WhatsApp, the reason to persist, fake Missions, Midnight, the Mole, favors in hours, AI fakes, and the flow, all simulated |
| [`docs/V04.md`](docs/V04.md) | What v0.4 builds: Pots, Chapters and Missions, with their rules |
| [`docs/IMPACT.md`](docs/IMPACT.md) | Every OPTIONS.md idea simulated: what to build next, what to skip, and why fewer features win |
| [`docs/OPTIONS.md`](docs/OPTIONS.md) | Pooling money and compliance options, whether swapping is legal, and the Fight Club layer |
| [`docs/V03.md`](docs/V03.md) | What it would take to get from 23% to 90%, and what v0.3 adds |
| [`docs/DIARY.md`](docs/DIARY.md) | 30 days as a real user on v0.1 and v0.2, plus a real-world test plan |
| [`docs/DEEPER.md`](docs/DEEPER.md) | The "deeper, not bigger" method, the rewritten prompt, and sources |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design bible: thesis, currencies, loops, guardrails, v0.2 changes |

## Run it

No build step. Open `prototype/index.html` in a browser.

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
