# Which ideas to build: the OPTIONS.md ideas, simulated

The question: *of the pooling options, the Fight Club layer and the niche ideas, which have the highest impact if we build them?*

**Short answer:**
- **Build three:** pledge-then-pay **Pots**, **Chapters** and **Missions**.
- **Add three that are cheap:** **Homework**, **time-based favors** and **Duels**.
- **Leave out** anything where the app holds money, favors turn into cash, or people get hurt.
- **Ship fewer features.** Once extra features cost users anything at all, the top three beat shipping everything.

**Built in v0.4:** see [`V04.md`](V04.md). **Next round (v0.5):** Pacts, Midnight, the Mole and a simpler flow, simulated on top of v0.4 in [`V05.md`](V05.md).

The interactive version is the **What to build next** tab in [`prototype/index.html`](../prototype/index.html). Its candidate ideas are also toggles in the Simulator tab, and it can re-run the ranking live.

## Method

- **Same engine as v0.3.** It still matches published retention benchmarks and still reproduces the trueque and Bunz collapses. With every new idea switched off, it gives exactly the same results as v0.3 (checked run by run).
- **Each idea is a mechanic with rules.** It decides when people get pulled back, what each open is worth to them, what makes them quit, and what it does to the favor economy. Its numbers are anchored to the v0.3 mechanics it most resembles, as listed below.
- **Add one, paired.** Each idea was added to v0.3 alone on the same 16 seeds (150 friend groups of 12, 120 days), and the change in day-30 retention was measured seed by seed. The whiskers on the chart are ±2 standard errors.
- **Remove one from the full set.** All ten safe ideas were switched on, then each was taken away in turn.
- **Sensitivity.** In 20 runs, every idea's strength was drawn at random between 0.5× and 1.5× its default. For each idea, the scorecard counts how often it landed in the top three.
- **Feature cost.** Each added feature adds a small fixed annoyance ("one more thing to learn"). The tests compare v0.3 plus the top 3, the top 5 and all 10 as that cost rises.

| Idea | How it's modeled |
|---|---|
| Pots, ledger only | About every three weeks a circle with 3+ active members opens a pot for a trip or purchase. While it's open, members get pulled back to watch it fill and are less likely to quit, since their money is in the trip. 75% complete; a failed pot annoys the people in it |
| Pledge, then pay | Same as Pots, but nobody pays until 4 people commit. 85% complete, and a failure costs almost nothing because no money moved |
| Partner holds money | 92% complete because paying is frictionless. Tested alone and with a partner failure on day 60: pots freeze, favor confidence drops 60%, and everyone with money in a pot is badly annoyed |
| Chapters | Invites are accepted more often because you vouch for the person. Private 24-hour videos make dares easier to accept. Members with 3+ active friends are less likely to drift away. If someone you vouched for quits within three weeks, you take a hit. Less of the strangers' feed |
| Homework | One weekly courage assignment, worth most to the least bold people, and wearing off slowly |
| Duels | When a favor isn't honored, it goes to a duel 60% of the time. The debt is settled and both sides get value, more when the duel happens at a Zone |
| Sanctioned combat | An extra Zone Night activity with a small chance of a minor injury |
| Missions | A monthly city-wide stunt: high value for those who join, plus a wave of word-of-mouth sign-ups worth 4% of active users |
| Shed | A monthly giveaway that adds supply to the circle's Market |
| Wanderers | One item per circle that changes hands about every 10 days, as a small handoff event |
| Bounties | Requests that add demand at Market Day; filled bounties pay off, expired ones annoy |
| Time-based favors | Hour-for-hour pricing makes uneven trades rarer and board favors easier to agree on |
| Favor cash-out *(no-go)* | People buy favors with money (free issuance) and IOUs drift to strangers |
| Real fights *(no-go)* | Like combat, with a 4% chance of real injury |
| Pay-to-enter prizes *(no-go)* | Fewer people enter Drops and most of those who do lose |

## Results

### Add one idea to v0.3 (day 30 is 58.6%)

| Idea | Day 30 vs v0.3 | On v0.2 instead | Least bold third | Growth (joined) | Favor confidence | People hurt | Top 3 under ±50% |
|---|---|---|---|---|---|---|---|
| Partner holds the money | **+5.1** ± 1.3 | +4.5 | +4.9 | +0.2 | −0.4 | ≈ 0 | – |
| Pledge, then pay | **+4.8** ± 1.8 | +3.8 | +4.9 | +0.1 | +0.1 | ≈ 0 | 75% |
| Pots, ledger only | **+4.6** ± 1.5 | +4.1 | +4.0 | −0.4 | +0.5 | ≈ 0 | 65% |
| Chapters | **+4.5** ± 1.1 | −0.1 | +4.0 | +5.8 | −0.3 | ≈ 0 | 85% |
| Missions | **+3.5** ± 1.3 | +1.8 | +2.8 | +7.3 | −0.1 | ≈ 0 | 25% |
| Homework | **+2.9** ± 1.3 | +3.2 | +2.2 | +0.4 | −0.3 | ≈ 0 | 40% |
| Time-based favors | **+2.8** ± 1.8 | +1.3 | +4.0 | −0.2 | −0.2 | ≈ 0 | 5% |
| Real fights *(no-go)* | **+1.6** ± 1.9 | +0.0 | +1.2 | +0.7 | −0.2 | **+41** | – |
| Bounties | **+1.2** ± 1.3 | +1.2 | +0.8 | −0.1 | −0.3 | ≈ 0 | 0% |
| Sanctioned combat | **+1.1** ± 1.4 | +0.0 | +0.3 | +0.3 | −0.1 | +9 minor | 0% |
| Duels | **+1.0** ± 1.5 | +1.0 | −1.0 | −0.1 | +8.1 | ≈ 0 | 0% |
| Wanderers | **+0.9** ± 1.2 | +1.0 | −0.2 | +0.4 | +0.2 | ≈ 0 | 0% |
| Shed | **+0.7** ± 1.5 | +0.5 | +1.2 | +0.0 | +0.0 | ≈ 0 | 5% |
| Pay-to-enter prizes *(no-go)* | **+0.4** ± 1.2 | +0.0 | +0.2 | −0.0 | +0.1 | ≈ 0 | – |
| …and the partner fails on day 60 | **+0.3** ± 1.4 | +1.3 | −0.1 | +1.4 | −0.4 | ≈ 0 | – |
| Favor cash-out *(no-go)* | **−5.8** ± 1.1 | −3.5 | −5.6 | +1.9 | −34.9 | ≈ 0 | – |

Points of day-30 retention, ± 2 standard errors over 16 paired seeds. "People hurt" over 120 days; differences under 4 are noise.

### Remove one from v0.4 (all ten safe ideas: day 30 is 75.0%)

| Removed | Day 30 drops by |
|---|---|
| Pledge, then pay | 3.1 ± 1.2 |
| Chapters | 2.7 ± 0.8 |
| Missions | 2.0 ± 0.9 |
| Homework | 1.4 ± 1.2 |
| Time-based favors | 1.2 ± 0.7 |
| Duels | 1.1 ± 1.0 |
| Shed | 0.5 ± 1.2 |
| Wanderers | 0.4 ± 1.2 |
| Sanctioned combat | 0.3 ± 1.0 |
| Bounties | 0.2 ± 0.7 |

The biggest losses come from removing Pledge, Chapters and Missions, the same three that lead when added alone. Wanderers, Shed, Bounties and combat each cost under half a point when removed.

Adding the best remaining idea at each step gives: v0.3 58.6% → +Pledge, then pay 63.5% → +Chapters 67.7% → +Missions 69.4% → +Time-based favors 70.6% → +Homework 72.5% → +Duels 73.4% → +Sanctioned combat 74.2% → +Shed 74.4% → +Wanderers 74.8% → +Bounties 75.0%. The first three ideas add about 11 points; the last five add about 2.5.

### Fewer is better

| Cost per feature | v0.3 | + top 3 | + top 5 | + all 10 |
|---|---|---|---|---|
| none | 58.8% | 69.1% | 72.7% | 75.0% |
| low | 58.8% | 67.9% | 71.0% | 71.6% |
| medium | 58.8% | 66.7% | 67.1% | 59.4% |
| high | 58.8% | 65.6% | 62.8% | 48.0% |

No single feature costs much on its own. Together, ten features push people past the point where the app feels like work, and quitting rises sharply. At medium cost, top 3 and top 5 tie and all 10 falls back to v0.3. At high cost, only the top 3 still clearly beats v0.3. Everything you build has to earn its place.

## What it means

1. **The money options tie, so pick the one with no custody.** Pledge-then-pay, ledger-only pots and a licensed partner are all within each other's error bars. The partner option adds licences and the Synapse risk, and a partner failure erases the whole gain. Pledge-then-pay also fails cleanly: no money moves until the goal is met.
2. **Chapters need Zones.** On v0.3 they're a top idea. On v0.2 they add nothing to retention, because without chapter nights an invite-only club is just a smaller feed. They grow the network either way.
3. **Missions are the growth idea.** They bring in the most new people of anything tested, so they're how the city finds out. On retention alone they're close to Homework, and in the sensitivity runs Homework makes the top three more often (40% vs 25%). Missions keep their place because of growth.
4. **Duels are the trust idea.** They barely move retention, but favor confidence rises about 8 points. Build them if disputes show up in the diary test.
5. **Homework is the safest first ship.** It's small, works with or without Zones, and does the most for the least bold third of users.
6. **The model confirms all three no-gos.** Favor cash-out is the only idea that loses users, and favor confidence drops about 35 points. Real fights add about 40 injuries for a point and a half. Pay-to-enter prizes add nothing and make Drops a lottery.

## What the model can't see

- It counts opens, not whether an evening was loved or dreaded. The diary test still decides.
- Every idea gets the value its rules imply. Nothing in the model is badly executed, and in real life most things are.
- Day-30 levels above 70% have no real-world precedent. **Trust the ranking, not the level.**
- Legal load and build size in the page's scorecard are judgment calls from [`OPTIONS.md`](OPTIONS.md), not model outputs.

## Real-world test for the top three
Add to the v0.3 test in [`V03.md`](V03.md#real-world-test-extended):
- **One real pledge pot per circle** (a dinner, a day trip), settled through people's own payment apps.
- **One chapter night** at the partner Zone, with invite-only videos that delete after 24 hours.
- **One Mission** (a 60-second synchronized freeze in a public square, with a permit if needed). Count how many non-members ask how to join.

**Pass if:**
- at least 70% of each pot completes;
- chapter members open the app more in the week after chapter night than in the week before;
- the Mission produces at least one sign-up per five participants;
- nobody describes a pot as pressure to spend money they didn't want to spend.
