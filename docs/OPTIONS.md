# Money, legality, and the Fight Club layer

Answers to three questions: *Is pooling money the same as "the ledger as money," and does it need compliance? Is swapping illegal? Any Fight Club–inspired or niche ideas?*

> Not legal advice. Rules depend on where you launch. Talk to a fintech lawyer before the app ever touches real money.

---

## 1. Pooling money vs. the ledger

They're related but legally very different.

| | The ledger (v0.3) | Pooling money for a trip or a purchase |
|---|---|---|
| What moves | Nothing. It records who owes whom, in favors | Real money goes into a shared pot |
| Who holds value | Nobody | Whoever holds the pot (you, if the app does) |
| Regulation | Light: it's a record | Heavy if you hold or move funds: money transmission (US: FinCEN registration plus state licenses), payment or e-money licensing (UK/EU), prepaid-instrument rules (India, RBI), and KYC/AML everywhere |

**The line that matters: does the app ever hold or move other people's money?** Splitwise is the proof that you can stay on the right side of it. It tracks balances but never takes custody of cash, and settlement happens in Venmo or PayPal.

### Your options for pooling, from least to most compliance

| Option | How it works | Compliance | Use it for |
|---|---|---|---|
| **A. Ledger only** | Track the pot and who's in. Each person pays the organizer or merchant through apps they already use (deep links to Venmo, PayPal, UPI, bank transfer) | Lowest. You never touch money | **The MVP.** Trips, group gifts, shared costs |
| **B. Pledge, then pay** | Everyone commits; the app shows the goal filling up. When it's hit, each person pays the merchant or organizer directly | Low. Still no custody | "We get the PS5 if 6 of us commit by Friday" |
| **C. Licensed partner holds the money** | Embedded-finance provider holds funds; you're the interface | Medium. You inherit the partner's risk | Only once A and B are proven |
| **D. Get licensed yourself** | Your own licenses | High: slow, expensive, ongoing audits | Only at real scale |

**Option C's warning: Synapse (2024).** A middleware company sat between fintech apps and their partner banks. When it collapsed, partner banks held about $180M against about $265M owed to customers, a shortfall of roughly $85M, and users' savings were frozen for months. If you ever go with a partner, pick one with a direct bank relationship and clean daily reconciliation.

### Keep favors out of financial regulation
Favors stay a game ledger, not money, as long as:
- **Nobody can buy favors with money.**
- **Nobody can cash favors out.**
- **No free issuance** (no welcome bonuses or drops paid in favors). That's also the trueque/Bunz lesson.

The moment favors convert to or from real money, you're in e-money or virtual-currency territory, plus tax.

---

## 2. Is swapping illegal?

**No. Barter is legal.** Three things to know:

- **Tax.** In the US, the IRS treats barter as taxable at fair market value. Commercial barter exchanges must issue Form 1099-B. But the IRS says informal, noncommercial swaps of similar services (its example is a babysitting co-op) aren't a "barter exchange."
- **Time banks** ("one hour of help = one hour credit, whatever the skill") are widely treated as non-taxable mutual aid. That rests on unpublished IRS letters and advocacy summaries, not firm rules, so verify before relying on it.
- **Platform risks** are the real work: prohibited items (weapons, alcohol, medicine, animals, counterfeits, recalled products), stolen goods, meetup safety, and marketplace rules if you charge fees.

**Design choices that keep INSANE on the informal side:** friends-only circles, no fees on swaps, favors measured in time, and item provenance (which also helps with stolen goods).

### Two more legal tripwires
- **Drops and prizes:** prize + chance + payment = an illegal lottery in most places. Drops must never require paying to enter.
- **Betting on dares:** letting people stake money on whether someone completes a dare is gambling. Stakes stay as items and favors only.

---

## 3. The Fight Club layer (legal version)

Fight Club's real appeal isn't punching. It's **secrecy, rules, belonging, and shedding the things you own.** INSANE can have all of that without a single assault charge. Real fighting arranged between users is a no-go: consent doesn't cover serious injury in most places, combat sports are regulated by athletic commissions, and the liability lands on you.

| Idea | Fight Club echo | How it works |
|---|---|---|
| **Chapters** | "The first rule…" | Invite-only, and you stake your Reliability on anyone you vouch for. Chapter nights at a Zone. Chapter videos are visible only to the chapter and vanish after 24 hours |
| **Homework** | Tyler's homework | Weekly comfort-zone assignments ranked on courage, not danger: ask a stranger for something absurd, get rejected ten times (after Jia Jiang's *100 Days of Rejection*). Sells to people who would never do "insane" pranks |
| **Shed** | "The things you own end up owning you" | Monthly ritual: give away something you love into a swap loop. Your profile shows what you've let go. Anti-consumerism *is* the barter thesis |
| **Sanctioned combat** | The fights | Pillow fights (Toronto's Pillow Fight League ran this as a staged sport), foam-sword combat (as in LARP leagues), inflatable sumo, arm wrestling, roast and rap battles, debate duels. Anyone who wants real boxing goes through partner gyms that run training, medicals and licensed bouts |
| **Duels** | Settling it in the basement | Two members disagree about a ledger entry. They settle it with a duel at Zone Night (best of seven, arm wrestle, quiz) and the circle votes. Turns the app's most boring moment into its best one |
| **Alter egos** | Tyler | Chapter-night handles separate from your everyday profile |
| **Missions** | Project Mayhem, inverted | Secret coordinated public spectacle with no victims: synchronized freezes (Improv Everywhere's Grand Central freeze), mass compliments, guerrilla gardening, flash mobs. Rules: no property damage, no unwilling targets, permits for crowds |

## 4. Other niche ideas

- **Wanderers.** Items built to keep moving: a jacket, a book or a camera that must be passed on within 30 days and carries a public log of everyone who had it. BookCrossing has done this with books since 2001.
- **Bounties.** "I need a working camera by Friday." The circle hunts it through swap loops.
- **Time-bank favors.** One hour = one favor, whatever the skill. It's legally safer and more egalitarian, and lawyers and plumbers trade at par.
- **Skill duels.** "Teach me something in ten minutes," filmed at a Zone, and the crowd votes on who learned more.

### No-gos
- **Circle "insurance" funds** ("we all chip in and cover whoever's bike gets stolen"). That's insurance, which is heavily regulated.
- **Real fights between users.**
- **Prizes you pay to enter.**
- **Cash-out of favors.**

## Which of these to build
All of them were simulated: see [`IMPACT.md`](IMPACT.md). Short version: pledge-then-pay Pots, Chapters and Missions first; Homework, time-based favors and Duels as cheap additions; the no-gos really are no-gos.

## Sources
- Barter tax: [IRS Topic 420](https://www.irs.gov/taxtopics/tc420.html)
- Time banks: [Community Currencies Law: time banks](https://communitycurrencieslaw.org/time-banks/), [tax exemption](https://communitycurrencieslaw.org/choice-of-entity-and-tax-exemption/), [Yahoo News](https://news.yahoo.com/time-banks-way-spend-hour-183916839.html), [Yle on Finland](https://yle.fi/a/3-6722403)
- Synapse: [TechCrunch](https://techcrunch.com/2024/08/22/synapses-collapse-has-frozen-nearly-160m-from-fintech-users-heres-how-it-happened), [NBC News](https://www.nbcnews.com/business/business-news/synapse-bankruptcy-trustee-says-85-million-customer-savings-missing-fi-rcna156108), [NBC News, savings vanish](https://www.nbcnews.com/business/consumer/-no-money-thousands-americans-see-savings-vanish-synapse-fintech-crisi-rcna181419)
- Splitwise as a ledger: [WRAL/CNN](https://www.wral.com/venmo-s-newest-feature-helps-users-track-manage-and-settle-group-expenses/21148522/), [Altss profile](https://altss.com/profile/splitwise.md)
