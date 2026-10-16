# INSANE

**When money stops meaning anything, people become the currency.**

A concept for a post-money barter-and-dare app. Swap stuff in multi-person loops, pay with dares your friends film and rank on insanity, and carry a ledger of favors.

## What's here

| Path | What it is |
|---|---|
| [`prototype/index.html`](prototype/index.html) | **v0.2.** Clickable phone app built around friend circles (Today, Market, Circle, Ledger), plus a research console: the 30-day diary, a calibrated simulator, what changed and why, and the method |
| [`prototype/v1/index.html`](prototype/v1/index.html) | v0.1, the original prototype and its first simulator |
| [`docs/DIARY.md`](docs/DIARY.md) | 30 days as a real user, on v0.1 and then v0.2, plus a two-week real-world test plan |
| [`docs/DEEPER.md`](docs/DEEPER.md) | The "deeper, not bigger" method applied to this project, the rewritten prompt, and sources |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design bible: thesis, currencies, features, loops, guardrails, and the v0.2 changes |

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
