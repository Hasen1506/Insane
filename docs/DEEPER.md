# Going deeper, not bigger

This applies the "deeper version" prompt to the original INSANE request. The method:

> Before rewriting it: (1) say what a top professional in this field would do here that I'm not asking for; (2) name the rawest material they would start from instead of what has already been digested for me; (3) name the specific methods and tools they would use; (4) say what, other than you or me, would show the result is right. Then rewrite my prompt to ask for exactly that.

The original request was roughly: *"Design a barter/dare app for a dystopian future where money loses value. Explore the most addictive loops, multitasking in parallel. Simulate it and show how the app could be."*

---

## 1. What a top professional would do that wasn't asked for

A senior product designer or researcher wouldn't start from addictive loops. They'd start from the reasons the app fails.

- **Find the atomic network.** What's the smallest group of people for whom the app works on day one? A barter app with two friends on it has nothing to match. v0.1 assumed everyone's friends were already there.
- **Check frequency.** How often does a normal person have something to swap? Monthly at best. A daily-use app can't be built on a monthly behavior. Something else has to supply the daily reason to open.
- **Handle the physical handoff.** A three-person loop means three handoffs. If any one person flakes, the loop half-completes and someone is left out of pocket. v0.1 ignored logistics entirely.
- **Read the post-mortems.** Barter currencies have been tried at scale, in real money crises, and failed in specific, documented ways.
- **Pick a north-star metric that isn't DAU.** For this app: *completed exchanges per active circle per week.* Hooks can inflate DAU while exchanges fall.
- **Test with people before building.** Run the whole thing in a group chat for two weeks, with a human acting as the matcher.
- **Set pass/fail criteria in advance**, so the result can't be rationalized afterwards.

## 2. The rawest material

Not my summary of "addictive loops." Instead:

| Material | Why it matters |
|---|---|
| **Argentina's trueque clubs, 2001–2002** | The closest real case of "money stopped working, people bartered." The network reached an estimated 2.5 million people by mid-2002. New members got 50 *créditos* to start, dozens of credit varieties circulated, counterfeiting spread, trust eroded, and the system broke down at the end of 2002. |
| **Bunz Trading Zone and BTZ, 2018–2019** | A Toronto barter community that launched its own token. Every user got 1,000 BTZ free; more than 130 million were in circulation within months and 200+ Toronto businesses accepted it. Supply was then expanded by direct deposits. In 2019 the program was abruptly scaled back, staff were laid off, and community admins defected. |
| **Published retention benchmarks** | Social/messaging apps keep roughly 25–29% of users on day 1, 9–16% on day 7 and 4–10% on day 30 (Adjust, AppsFlyer, Statista compilations). Any simulation has to land in this range before its comparisons mean anything. |
| **BeReal's rise and fall** | The best-known daily-prompt app. Daily users peaked at an estimated 15–20 million in late 2022, and Apptopia estimated about 6 million by spring 2023. That's the novelty decay any "daily dare" must plan for. |
| **WIR Bank (Switzerland, since 1934)** | A mutual-credit system between businesses that has survived for 90 years, using credit limits and no free issuance. It shows the version that lasts. |
| **A diary of one real user, day by day** | Not aggregate loops. What one person opens, when, why, and the day they stop. |

## 3. Methods and tools

- **Diary study and cognitive walkthrough.** Play one user through 30 days on the actual prototype, plus three contrasting personas.
- **Fogg Behavior Model (B = MAP).** For each daily action: is there motivation, is it easy enough, and is there a prompt? Most of v0.1's days fail on prompt or motivation.
- **Cohort retention curves (D1/D7/D30)** instead of DAU, and the *smile curve*: retention rising later as friends arrive.
- **Atomic-network / cold-start analysis.** What share of friend groups ever reach four active members?
- **Liquidity math for matching.** Match probability rises with pool size. Cycle matching is borrowed from kidney exchange (Roth, Sönmez and Ünver).
- **Mutual-credit rules.** Credit limits, no free issuance, periodic clearing (WIR, LETS, time banks).
- **Agent-based modeling, done properly.** Calibrate to benchmarks, reproduce known history, run sensitivity analysis, average over seeds.
- **A pre-mortem.** Assume it's a year later and the app is dead. Why?

## 4. What, other than you or me, would show the result is right

1. **Benchmarks.** A no-hooks version of the simulator must land inside published social-app retention ranges *before* any design comparison is trusted. (It does: ≈29% / 10% / 7% on D1/D7/D30.)
2. **History, out of sample.** Turning on free welcome credits must reproduce the trueque/Bunz pattern: confidence in credits collapses and exchange volume falls. (It does: favor confidence drops from ≈86% to ≈25% and weekly swaps fall by more than half.)
3. **Real people.** A two-week concierge test with three friend circles of 8–12 people, judged against thresholds set in advance (see [`DIARY.md`](DIARY.md#real-world-test-plan)).
4. **A stranger's pre-mortem.** Someone who didn't design it lists how it dies, and each item gets a mechanism or an admission.

## 5. The rewritten prompt

> I'm designing INSANE, a barter-and-dare app for a future where money has lost its value. Don't add features. Instead:
>
> 1. **Be a real user.** Play one realistic person for 30 days, day by day, on the current prototype. Log minutes in the app, what triggered each open, what I got, what annoyed me, and the day I'd quit. Do a shorter run for three contrasting personas (a performer, a trader, a lurker).
> 2. **Start from raw material.** Use post-mortems of real barter currencies (Argentina's trueque clubs 2001–02, Bunz's BTZ 2018–19, WIR), published D1/D7/D30 retention benchmarks for social apps, and BeReal's rise and fall as the daily-prompt case.
> 3. **Use these methods:** diary study and cognitive walkthrough; Fogg's B = MAP for each daily action; cohort retention and the atomic network for cold start; liquidity math for swap matching; mutual-credit rules (credit limits, no free issuance).
> 4. **Rebuild the simulator so it earns trust:** (a) calibrate a no-hooks version to the published retention ranges, (b) reproduce the trueque/Bunz collapse when free credits are switched on, and only then (c) compare v0.1 with a redesigned v0.2.
> 5. **Redesign only what the diary and simulator show is broken.** For every change, name the diary moment it fixes.
> 6. **End with a two-week real-world test** with three friend circles and pass/fail thresholds set in advance. Say so plainly when the answer is "this doesn't work."

The rest of this branch is that prompt, executed: [`DIARY.md`](DIARY.md), the rebuilt simulator and the v0.2 prototype in [`prototype/index.html`](../prototype/index.html), and the updated [`DESIGN.md`](DESIGN.md).

## Sources

- Trueque: [Tiempo Argentino](https://www.tiempoar.com.ar/ta_article/el-club-del-trueque-en-la-boca-un-simbolo-de-como-fue-sobrevivir-sin-plata/), [Observatorio de la Economía Latinoamericana](https://www.eumed.net/cursecon/ecolat/ar/2005/br-trueque.htm), [Ámbito, Feb 2002](https://www.ambito.com/portada-principal/el-trueque-mueve-ya-1200-millones-anuales-el-pais-n3159776), [P2P Foundation](https://wiki.p2pfoundation.net/Argentine_Social_Money_Movement)
- Bunz / BTZ: [Wikipedia](https://en.wikipedia.org/wiki/Bunz_Trading_Zone), [Cointelegraph](https://cointelegraph.com/news/canadian-barter-platform-introduces-its-own-cryptocurrency), [BlogTO, Sept 2019](https://www.blogto.com/tech/2019/09/bunz-btz-stores-reduced-toronto/), [BetaKit](https://betakit.com/?p=219567), [HKU case study](https://www.acrc.hku.hk/Case/Detail/2204)
- Retention benchmarks: [Phiture](https://phiture.com/mobilegrowthstack/managing-retention-rate-benchmarks-and-expectations/), [Adjust](https://demo-1.adjust.com/blog/what-makes-a-good-retention-rate/), [Sonar (Adjust 2024 data)](https://trysonar.app/blog/app-user-retention-benchmarks-and-what-moves-it), [MWM](https://mwm.ai/glossary/retention)
- BeReal: [PetaPixel](https://petapixel.com/2023/02/22/bereal-may-be-on-the-out-users-have-nearly-halved-since-peak), [Platformer](https://platformer.news/how-bereal-missed-its-moment), [Wikipedia](https://en.wikipedia.org/wiki/BeReal)
