# INSANE

**When money stops meaning anything, people become the currency.**

A concept for a post-money barter-and-dare app. Swap your stuff in multi-person loops, pay with dares your friends film and the crowd ranks on insanity, and carry a ledger of favors that, eventually, strangers can buy.

## What's here

| Path | What it is |
|---|---|
| [`prototype/index.html`](prototype/index.html) | Interactive prototype: a clickable phone app (Feed, Swap, Dares, Ledger, Lanes) and an agent-based simulator that shows what the engagement loops do to a population over 90+ days |
| [`docs/DESIGN.md`](docs/DESIGN.md) | Design bible: thesis, the four currencies, features, the nine engagement loops, simulator findings, the dystopia roadmap, and guardrails |

## Run it

No build step. Open `prototype/index.html` in a browser.

## The short version

- **Swap**: the app finds 3–4 person trade loops, so barter works even when no two people want each other's stuff.
- **Dare**: pay for a swap with a filmed dare. The crowd rates it on Insanity, Creativity, Commitment and Cringe. Chains make each dare top the last.
- **Ledger**: uneven trades create favors (IOUs). Favors can be sold, and that's where money quietly comes back.
- **Lanes**: up to five swaps, dares and chains run in parallel, each on a countdown.

The simulator's main finding: maximum-addiction settings spike engagement, then collapse it, because the feed's escalation pushes dares into danger. The same hooks with guardrails (an insanity cap, danger down-ranking, a debt jubilee) retain more than twice as many users at day 90.
