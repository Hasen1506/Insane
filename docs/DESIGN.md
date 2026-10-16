# INSANE: design bible (v0.1)

> When money stops meaning anything, people become the currency.

INSANE is a concept app for a future where cash has lost its meaning. It runs on three things people already trade with no money involved: **stuff**, **favors**, and **attention**. You swap items in multi-person loops, pay with dares your friends film and the crowd ranks, and carry a ledger of favors that, eventually, strangers can buy.

This document covers the thesis, the economy, the screens, the engagement loops, what the simulator shows, and the guardrails needed to ship it without building the dystopia it describes.

The interactive prototype and simulator are in [`prototype/index.html`](../prototype/index.html).

---

## 1. Thesis

Money does three jobs: it's a **medium of exchange**, a **store of value**, and a **unit of account**. Barter fails at all three:

| Job | Why barter fails | How INSANE fixes it | What that fix becomes |
|---|---|---|---|
| Medium of exchange | You need someone who has what you want *and* wants what you have (the "double coincidence of wants") | **Cycle matching**: find 3–4 person loops (A→B→C→A), the way kidney-exchange programs match donors | A clearing house |
| Store of value | You can't save half a goat | **Favors**: signed IOUs that cover the difference in an uneven swap | Money, once IOUs circulate |
| Unit of account | Nobody agrees what a haircut is worth against a PS4 | **Favor estimates** on every item, from recent comparable swaps | Prices |

The twist the app is built around: **if you fix barter with software, you rebuild money by accident, and the new money is made of obligations between people.** That's the future nobody expects, even though it's already here.

## 2. The four currencies

| Currency | What it is | Earned by | Spent on | Transferable | Decays |
|---|---|---|---|---|---|
| **Stuff** | Items, skills, hours of time | Owning, making, receiving | Swaps, dare stakes | Yes, with a public provenance trail | No |
| **Favors** | IOUs from uneven swaps or bought-out dares | Giving more than you get | Settling imbalance, skipping dares | Yes, and that's where it turns dark | No (can accrue obligations) |
| **Nerve** | Reputation from highly rated dares | Doing dares the crowd ranks high | Dare tiers, boosting chains | No | Slowly |
| **Trust** | Reliability: do you finish what you start? | Completing swaps, repaying on time | Collateral: more lanes, bigger swaps | No | Yes, while idle |

## 3. Core features

### 3.1 Swap
- List what you have and what you want. No prices, only a **favor estimate**.
- The matcher finds **loops**: *You (bike) → Dev (sourdough starter) → Maya (guitar lessons) → You*. Each loop shows a fit score and any imbalance.
- Imbalance settles as fractional favors.
- **Mystery swap**: ship something blind and receive something from a stranger a few loops away.
- **Provenance**: every item carries the list of everyone who owned it. Long trails make items "legendary".

### 3.2 Dare
- Any swap can be paid partly or fully with a **dare**: *"Dev gives you the bike if you walk your whole commute backwards on camera."*
- The dare is filmed in-app and posted to friends, then to the wider feed.
- **Chains**: a dare can be opened as a chain. Each link must out-score the previous one, or the chain breaks and every earlier link loses their stake.
- **Counter, buy out, decline.** Buying out costs a favor. Declining is free (guardrail).

### 3.3 Crowd ranking
Every dare video is rated on four sliders:

| Metric | Meaning |
|---|---|
| **Insanity** | How absurd and unexpected it is |
| **Creativity** | How original the execution is |
| **Commitment** | How fully the person went for it |
| **Cringe** | Second-hand embarrassment |

`rank = 0.35·insanity + 0.30·creativity + 0.25·commitment + 0.10·cringe`, and **a danger flag multiplies the reward by zero.** Rankings feed a weekly **Insanity League** with promotion and demotion. Rating pays a little Nerve, which keeps people rating.

### 3.4 Ledger
- Who owes you, whom you owe, and **who currently holds each IOU**.
- Trust meter with visible decay.
- Sell an IOU you're owed (to a collector, for Nerve). The debtor is notified that the holder changed.

### 3.5 Lanes (parallel multitasking)
- Up to **five** swaps, dares and chains run at once, each with a countdown.
- Finishing a lane pays Trust. Letting one expire costs it, and a broken chain costs a lot.
- More lanes unlock at higher Trust. Lanes are the app's "always something in flight" engine.

## 4. The nine engagement loops

Each loop below is a well-documented behavioral lever. The right-hand column is what it turns into without a ceiling.

| Loop | Mechanism | In the app | Unchecked |
|---|---|---|---|
| Obligation | Reciprocity norm | Open favors at the top of the ledger, visible to friends | Debt is why you open the app; the ledger never reaches zero |
| Escalation chains | One-upmanship, Zeigarnik effect | Each chain link must out-score the last | The insanity norm ratchets into physical danger |
| Crowd ranking | Social comparison | Four-slider ratings, weekly league | People design their lives around what will rank |
| Mystery swaps | Variable-ratio reward | Blind box from a stranger | Slot-machine compulsion |
| Trust decay | Loss aversion | Score falls every idle hour | People check in at 3 a.m. to stop a number falling |
| Honor streaks | Sunk cost | Consecutive-days counter multiplies stakes | Streak hostage |
| Parallel lanes | Open loops | Five concurrent countdowns | No natural stopping point, ever |
| Provenance | Collection, narrative | Ownership trail on every item | People trade for the story, not the object |
| Debt market | Liquidity | Sell IOUs to collectors | Strangers own your friendships |

## 5. What the simulator shows

The prototype includes an agent-based model (seeded, so runs are reproducible). Each user has boldness, susceptibility to hooks, and reciprocity, plus a small friend graph. Each day they decide whether to open the app, swap, dare, repay, or quit. Stress from debt and streak pressure raises churn. Harm from dangerous dares knocks people out and stresses their friends.

Representative results (400 users, 90 days, seed 7):

| Preset | Peak DAU | Day-90 DAU | Insanity norm | People hurt | Top 1% hold of IOUs |
|---|---|---|---|---|---|
| Maximum addiction | ~217 | ~66 | 10.0 | ~270 | 16–25% |
| Addictive + guardrails | ~211 | ~155 | ~6.5 | 0 | ~25% (debt market still on) |
| Humane | ~144 | ~84 | ~5.3 | 0 | ~5% |
| Barter only | ~106 | ~39 | n/a | 0 | low |

What it says:

1. **Unchecked escalation kills the app.** The feed rewards insanity, so the norm ratchets upward every day. It crosses the danger line around day 30, people get hurt, and churn wipes out the gains from every hook.
2. **The same hooks plus guardrails retain best.** Caps and danger down-ranking keep dares funny rather than dangerous, and the hooks then work in the app's favor.
3. **A debt market creates a debt aristocracy.** When IOUs are sellable, preferential attachment concentrates them into a small class of collectors.
4. **Barter alone is useful and boring.** Without dares there's no spectacle and almost no growth.

The model is a toy. Its coefficients are tuned to be plausible, not fitted to data. Use it to reason about *direction*, not to forecast numbers.

## 6. The dystopia, as a product roadmap

The bad future doesn't arrive as a collapse. It arrives as a sequence of reasonable product decisions:

1. **Season 1: "Swap, don't spend."** Anti-consumerist barter for friends. Private ledgers.
2. **Season 2: Favors go public.** To build trust, friends can see ledgers. Repayment goes up, and so does anxiety.
3. **Season 3: The IOU market.** Users want to sell debts they'll never collect. Collectors buy thousands at 60% of face value.
4. **Season 4: Proxy dares.** IOU holders can settle a debt by assigning a dare. "Dare farms" film debtors for views.
5. **Season 5: Trust becomes a credit score.** Landlords ask for it. Employers check Nerve. Your score drops while you sleep.

The point the app makes: **money never disappears. When it loses value it comes back as obligation between people, and software makes those obligations tradeable, rankable and permanent.**

## 7. Guardrails (the version you could ship)

- **Danger is never rewarded.** Insanity scores absurdity, creativity and commitment. A physical-danger flag removes reward and sends the video to review.
- **Banned dare categories:** anything involving non-consenting strangers, law-breaking, substances, heights, traffic, fire, weapons, or self-harm. **Under-18 accounts get swaps only.**
- **Declining is free.** Buying out costs a favor, never Trust.
- **Insanity ceiling.** Chains can't escalate past a cap; the next link has to win on creativity instead.
- **Debt jubilee** every 30 days for small IOUs.
- **IOUs transfer only inside your friend graph.** No anonymous collectors.
- **Decay pauses** at night and on days you mark as off. Lanes cap at five.
- **In-person swaps** happen in suggested public meeting spots, with the option to bring a friend.

## 8. Open questions

- How do you value services against goods without the favor estimate turning into a de facto price list?
- Does a public ledger raise trust or just raise anxiety? (Test with private-by-default and opt-in sharing.)
- Can chains stay fun if escalation is capped? Candidate answer: past the cap, links compete on creativity, not insanity.
- What stops a collector class from forming through side deals outside the app?
- Shipping logistics for mystery swaps across cities.

## 9. Next steps

1. Paper-prototype the swap loop with 10–15 friends using a shared spreadsheet as the matcher.
2. Run a one-week dare chain in a group chat with the four-slider rating, and watch where the insanity norm goes.
3. Build the loop matcher (a small graph-cycle search) as the first real piece of code.
4. Fit the simulator's coefficients to whatever data those two tests produce.
