# v0.7: the working app

> **Updated by [v0.8](V08.md):** places anywhere on Earth, the INSANE server (email sign-in, street maps, GPS, push, server-side checks), and v0.6's game brought back into the app. The stand-ins listed below are now real, or labelled in the app as a limit of claude.ai pages.

v0.1 to v0.6 were mock-ups with a simulator beside them. v0.7 is an app people can use: [`app/index.html`](../app/index.html). It's a single file. Published as a claude.ai artifact, it has real sign-in, shared live data and a privacy rule on every collection. Opened anywhere else, it runs as a demo on one device. The integrated prototype and research console stay at [`prototype/index.html`](../prototype/index.html).

---

## 1. The deeper prompt, applied to "finish the app"

The request: *"Fully finish off this app. Evaluate technical feasibility as you go. Fully functional, easy to navigate, different, quick and clear UX. Build anything left as a placeholder: maps, the actual sign-in, many users in different places."*

**What a top professional would do that wasn't asked for**
- **Cut to one loop and make it work end to end.** Before polishing anything, a senior product engineer gets a real person from "never heard of it" to "did something with friends" in one sitting. For INSANE that path is: sign in, name, city, one line, circle code, first message, first plan.
- **Separate what's real from what's a stand-in, and say so on screen.** A demo that fakes GPS or QR without saying so gets judged on the fake.
- **Instrument the funnel from day one.** Record the first time each person reaches each step, and the days they come back. With no numbers from real people, every design argument stays an opinion.
- **Put the safety rules in the data layer, not the UI.** Private journeys, author-free Midnight messages and owner-only test results are enforced by storage rules, so a modified page still can't read them.
- **Write the test before calling it done.** Several people on separate screens, doing the real things, with pass/fail checks.

**The rawest material**
- **Real people's step records.** Not my simulator: the `ev/<person>` records in the live app, read in the owner's **Test results** panel.
- **Platform documents.** What a web frame and a phone actually allow: Apple's Screen Time APIs, Google's usage-access policy, the artifact runtime's db rules, and the content security policy that blocks map tiles.
- **Shop owners.** Five conversations about whether they'd host a drop, and what they'd put up.

**Methods and tools**
- **End-to-end browser tests with five simulated people** in separate tabs sharing one store (Playwright, [`app/test/e2e.js`](../app/test/e2e.js)).
- **Storage rules checked at a lower access level.** Read each private collection as an ordinary user and confirm it comes back empty.
- **A feasibility table for every feature:** what this build does, what the phone app needs, and what it costs.
- **Pass/fail thresholds set before the real test** (section 6).

**What, other than you or me, shows it's right**
- The 41 automated checks passing.
- The storage rules refusing a lower-level read.
- Most of all, the funnel numbers from 10 or more real people over two weeks against the thresholds in section 6.

**The rewritten prompt**
> Turn INSANE into a working app that real people in different cities can sign into today. Build the one loop end to end: sign in, name, city and 3 km area, need/want/urge in their own words, start or join a circle by code, threads with plans and pledge-then-pay pots, journeys with ticks, the weekly city Decode, hosted drops with door codes and draws anyone can check, a feed without counts, calls that open temporary rooms between circles, messaging only after meeting in person, Midnight and sealed messages, Go dark, and download or delete my data. Enforce privacy in storage rules. Label every stand-in on screen. Record funnel steps and return days and show them only to the owner. Prove it with a multi-person browser test and a lower-level read of the private collections. Give a feasibility table for the phone app. Set the pass/fail numbers for a two-week test with real people before running it.

---

## 2. Your questions

### Needs, wants and urges: is a want something you reach over time?

Yes. The difference is the time horizon, and the app now says so under each box.

| | Means | Horizon | Becomes |
|---|---|---|---|
| **Need** | something to keep doing | this month | a pact: a weekly count, 21 days, two free misses a week |
| **Want** | something to reach | this season | a plan with steps, or a pot when money's involved; one tap makes it a circle plan |
| **Urge** | something to do once | this week | a dare, a 5-rung ladder, or something to say at Midnight |

**Storing journeys: yes, as long as it stays light.**
- Each person gets a private timeline in **You → Your story so far** of everything they did: ticks, rungs, plans, drops, Decode, people met, things sealed.
- Nobody else can read it, the app owner included. That's enforced by the storage rule, not by hiding it in the page.
- The circle sees only counts, such as "Run · 2 of 3 this week" or "Ladder · rung 2 of 5", never your words.

To avoid overthinking or overconfidence:
- One line per box, all three optional.
- The app shows how it read the line before anything starts.
- Dropping a journey has no penalty.

### Drops: sponsors, auctions, proximity reveal, or something else?

- **Sponsors, yes. Auctions, no.** The v0.6 simulation showed auctions pull every drop to the city centre: outskirts circles in reach fell from 100% to 41%.
- **Revealing a drop only when you get close to a hidden point is boring, as you suspected.** It's a hot/cold meter. It rewards GPS spoofing and running, and it gives circles nothing to do together.

What's built instead is **hosted drops**. A shop, stall, club or circle hosts one: one place, one hour, a door code shown at the counter. There are five kinds, chosen because each one makes circles do something together:

| Kind | How it works | Why it's fun |
|---|---|---|
| **Swap box** | Bring something, take what's in the box. The box keeps a public log of every swap. | It's the barter core of INSANE in physical form. The log becomes a story ("a Pulp 7-inch became a Polaroid became a sourdough starter"). |
| **Two-key** | Opens only when two different circles check in during the hour. Then everyone there gets the prize. | It makes circles meet each other, the growth loop. Nobody wins by arriving first. |
| **Counter dare** | Do the dare at the counter, then check in. | The shop gets a story, the circle gets a clip, and the dare is sized to a public place. |
| **Shop offer** | Everyone who turns up gets the offer. One circle is drawn for a bigger prize. | It's cheap for the shop. In 2017 Niantic said sponsors paid less than $0.50 per daily unique visit. |
| **Cash draw** | A sponsor puts up cash, drawn among circles that turned up and split within the winning circle. | It motivates the most, so it's kept small and always free to enter. |

**Rewards:**
- Default to shop offers and merchandise.
- Allow cash only as a free draw: no payment to enter. That keeps it a prize draw rather than a lottery under UK rules; get local advice before running one anywhere.
- Never give cash to individuals for arriving first. Cash plus racing is the combination behind the crowd and crash problems documented for Pokémon GO.

**The draw anyone can check.** The winner is picked by hashing the drop's id with the sorted list of circles that checked in. Anyone can recompute it, so the host can't pick a friend.

**Did this need a new simulation? No.** The open questions here are whether a swap box feels fun and whether shops will host. The model's numbers for those would just be my guesses. The real test is in section 6.

---

## 3. What's built

| Area | In the app |
|---|---|
| **Sign-in** | Your claude.ai account identifies you; no passwords. You pick the name your circle sees and confirm you're 16 or over. |
| **Places** | 49 cities plus "use any city". You pick one of nine 3 km zones. Only the zone is saved. |
| **Onboarding** | Four short steps: name, city and zone, need/want/urge with a live "How INSANE reads it" card, then start or join a circle. The scripted test finishes it in under 3 seconds of clicking. |
| **Today** | Journeys due, new messages, the Decode, the next drop, and sealed messages opening soon. |
| **Circle → Chat** | Threads for talk, plans (going / can't make it) and pots (pledge; it goes ahead at the minimum, then people pay the organiser directly). General is muted. Rooms with other circles show here while open. "What everyone's on" shows counts only. |
| **Circle → Midnight** | Unsigned messages, tonight or "some night this week", stored with no author field at all; two flags hide one. Sealed messages carry your name and open at a time you pick. |
| **Circle → People** | Members, who's dark, the invite code, people you've met, and **Meet someone**: a 6-digit code valid for 2 minutes, then direct messages. There are no cold messages from strangers. |
| **City → Map** | A drawn 3 km zone map: your zone, drops as stamps, tap to filter, OpenStreetMap links. Host a drop. |
| **City → Decode** | One puzzle a week per city. Hints unlock at 3, 8 and 15 solves in the city, or on Tuesday, Thursday and Saturday. Each solve brings the answer 3 hours closer for everyone. Points go by solve order, minus 15 per hint that's out. |
| **City → Feed** | Posts under the circle's name. No counts and no comments. Hide for you; three reports hide it for everyone. |
| **City → Calls** | Ask the city for a hand. The circle that answers opens a 3-day room with yours. |
| **City → League** | Weekly points: each circle's first Decode solve, plus 10 for each drop it turns up to. |
| **You** | Journeys with ticks, rungs and steps; your timeline; Go dark for 1 to 24 h, alone or asking your circle; download or delete your data; and, for the owner only, **Test results**. |

**Storage rules (enforced):**
- `data/users/<you>/…`: journeys, timeline, seen markers and Decode tries, readable only by you.
- `people/<you>`: everyone reads, only you write.
- `pair/<you>`: everyone reads, only you write.
- `ev/<you>`: step records, readable only by you and the owner.
- After publishing, I checked this: a probe record in `ev` was visible to the owner and came back empty when read as an ordinary user. Then I deleted it.

---

## 4. Technical feasibility, feature by feature

| Feature | This build | Phone app (production) | Cost / risk |
|---|---|---|---|
| **Sign-in** | claude.ai identity | Phone number + SMS code, plus Sign in with Apple / Google (Supabase Auth or Firebase Auth with Twilio). Age gate at 16, per the UK Children's Code. | Low. SMS costs about £0.03–0.05 per code. |
| **Many users, many places** | Shared live store, filtered by city | Postgres + PostGIS, with zones as H3 cells (resolution 7, about 5 km²). Realtime over websockets (Supabase Realtime). Row-level security mirrors the rules above. | Low to medium. |
| **Map** | Drawn zones and OSM links; map tiles are blocked by the frame's security policy | MapLibre GL with OpenStreetMap vector tiles (Protomaps or MapTiler) | Low. Tiles are about £0–50 a month at small scale. |
| **Location** | You pick a zone | Foreground GPS only at a drop (100 m geofence); never stored as a trail | Low. Must say why at the permission prompt. |
| **Meeting in person** | 6-digit code, 2 minutes | Rotating QR every 15 s, a Bluetooth check that the phones are in the same room, App Attest / Play Integrity | Medium. BLE behaves differently on iOS and Android. |
| **Door codes and draws** | Checked in the page; the code is in the drop record | Checked on the server; the code rotates on the host's phone; the draw runs in a server function and is published with its inputs | Low. |
| **Decode answers** | Hashed in the page; a determined person can read them from the source | Checked on the server, rate-limited | Low. |
| **Midnight / sealed** | Hidden in the page until release; stored readable | The server holds messages until release; Midnight keeps the author only in a moderation log people can't see | Low. |
| **Go dark** | Blanks this app | iOS: FamilyControls + ManagedSettings, individual authorisation (iOS 16+); needs Apple's Family Controls entitlement approved. Android: usage access + an overlay, with the Play policy declaration. | **High**: entitlement review and Play policy. Ship it after launch. |
| **Notifications** | Badges | APNs / FCM, pinging only the people in a thread, with quiet hours | Low. Noise is a design risk (v0.6: one busy room loses about 6 points). |
| **Pots** | Pledges only | Pledges only. People pay each other via payment links. INSANE never holds money, so no e-money licence is needed. | Low, by design. |
| **Moderation** | Hide, report (3 hides a post), owner deletes | A queue with text filters; trusted hosts; report-to-human within 24 h | Medium: it's people, not code. |
| **Export / delete** | Download JSON, delete everything | The same, plus account deletion (Apple requires in-app deletion) | Low. |

**Suggested phone stack:** Expo (React Native) + Supabase + MapLibre, with server functions for draws, codes and Decode. About 8 to 10 weeks for two engineers to reach parity with this build, without Go dark. Add 4 to 6 weeks for Go dark and the Bluetooth check.

---

## 5. Tests

`node app/test/e2e.js` opens five people in five tabs:
- Alice, Bob, Carol and Erin in Lisbon, across two circles;
- Dave in Manchester.

They go through 41 checks. **Result: 41/41 passed.** The checks cover:
- Onboarding reads the three lines into a Pact, a Plan + pot and a Ladder.
- Codes join the right circle.
- Badges appear and messages arrive live.
- A plan's going list and a pot's minimum work.
- The circle sees counts but not words.
- Decode is per city, with points by solve order.
- Wrong door codes are refused, and a two-key drop stays locked until a second circle arrives.
- League points add up.
- The feed has no counts, and hiding a post only hides it for you.
- Calls open rooms for both circles.
- Meeting in person enables direct messages, and there's no path to a stranger otherwise.
- Midnight messages store no author and stay hidden until midnight; sealed messages show their sender but not their text.
- Go dark blanks the app and the circle sees it.
- The timeline records events.
- Export works, the owner's test results count five people, and delete removes everything.
- There's no sideways scroll at 390 px, and no script errors.

**Three real bugs the test found and fixed:**
1. Live updates from other people replaced the screen even when nothing visible had changed, which could swallow a tap. The screen now only redraws when its content changes, and countdowns tick on their own.
2. Whoever showed the meeting code had no timeline entry, because only the person typing the code logged it.
3. Two timeline events a moment apart could overwrite each other. Timeline writes now go one at a time.

The suite was run twice in a row after the last fix: 41/41 both times.

---

## 6. The test the model can't run, with pass/fail set now

Run it with 10 or more people: two or three real circles, ideally one in another city, for two weeks.

**Setup:**
- Invite each person by email as an **Editor** from the Share menu. On a personal plan, people who only view, or who come through a public link, can look but can't post. This means Editors could also republish the page, so only invite people you trust.
- Host at least two drops with a friendly shop: one swap box and one two-key.

Read **You → Test results** on day 3, day 7 and day 14.

| Measure | Pass | Fail, and what it means |
|---|---|---|
| In a circle in the first session | ≥ 80%, typically under 5 min | < 60%: the circle step is the wall; try invite links |
| Typed a need, want or urge | ≥ 60% | < 40%: the screen asks too much; try a single box |
| Ticked a journey in week one | ≥ 50% | < 30%: the journeys don't fit people's lives |
| Came back on day 7 | ≥ 50% of those who had a week | < 30%: no reason to return; look at which steps the returners did |
| Completed plans or pots per circle per week (north star) | ≥ 1 | 0: it's a chat app, not a plans app |
| Turned up to a drop | ≥ 1 circle per drop; two-key unlocked at least once | 0: the drops are too far away or too dull; ask the shop |
| Unwanted contact reported | 0 | any: tighten meeting codes and calls |

Also talk to five shop owners. Pass if two of them would host a drop at no cost to them.

---

## 7. Known limits of this build

- **The checks live in the page.** Anyone with edit access and the know-how could read door codes, Decode answers and unreleased Midnight messages in the store. The phone app moves these checks to the server (section 4).
- **The store holds 25,000 records.** Messages are one record each and nothing prunes them yet. That's fine for a test of tens of people, not for a city.
- **No push notifications, GPS, QR, Bluetooth or Screen Time.** They're labelled as stand-ins on screen and in the side rail.
- **The map is a schematic of 3 km squares around a city's centre point, not streets.**
