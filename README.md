# INSANE

**When money stops meaning anything, people become the currency.**

A concept for a post-money barter-and-dare app. Swap stuff in multi-person loops, pay with dares your friends film and rank on insanity, and carry a ledger of favors.

## What's here

| Path | What it is |
|---|---|
| [`prototype/index.html`](prototype/index.html) | **v0.3.** The city is the board: Zones, Hunts, Drops, a League, and the ledger as your circle's money. Console: the road to 90%, your ideas tested, the simulator, and a week on v0.3 |
| [`prototype/v2/index.html`](prototype/v2/index.html) | v0.2: circles, Daily Dare, favor board, weekly Market Day, with the 30-day diary and calibrated simulator |
| [`prototype/v1/index.html`](prototype/v1/index.html) | v0.1, the original prototype |
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
