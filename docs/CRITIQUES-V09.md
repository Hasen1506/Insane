# v0.9 critiques: INSANE v0.8 tested live, as real people, on real phone profiles

**What was tested:** v0.8 at `fac3720` (`app/index.html` served by `server/server.js`, DEV mode, Node 22, fresh SQLite). Test date: 17 Oct 2026.

**Who drove it:** four people, driven by Playwright with system Chromium.
- **Meera** is a new solo user on a Pixel 7, in Minjur, Chennai.
- **Arjun** starts a circle on an iPhone 13, in Chetput.
- **Kavya** joins by invite deep link on a Pixel 7. Her name mixes Arabic and Latin script.
- **Ravi** joins by typing the code on a 1280 px desktop.

Arjun then plays a 14-day power user: plans, favors, pots, pacts with cheers, the daily dare, Midnight, Mole, dares, meet, feed, calls, league, map, host a drop, Mission, trail, profile, go dark, a 14-day clock jump, the back button, two tabs, export and delete. The run also covered a cold load on throttled 3G, offline, bad input, a reload mid-onboarding, a long name with emoji, RTL text and a double send.

**Two passes, both in light and dark mode (`color_scheme`):**
1. **As shipped.** No viewport meta, so the phones render 980 px wide. These shots are in `docs/v09-shots/raw/`.
2. **With `<meta name=viewport>` injected by the test.** This shows what the real mobile layout looks like once critique C01 is fixed. These shots are in `docs/v09-shots/`.

The drivers are `tools/livetest/live.py` and `tools/livetest/live_viewport.py`. The log and the network and audit numbers are in `docs/v09-shots/live-log.json`.

**Test harness caveat:** external hosts were route-blocked on purpose (Google Fonts, cdnjs, tile.openstreetmap.org), because they hang page load in the sandbox. So blank street maps and missing QR codes in these shots come from the harness. They still expose real failure modes when those hosts are slow, blocked or offline (C49, C58).

Severity:
- **P0:** blocks launch or a real phone, or is a security or privacy break.
- **P1:** a serious UX or safety gap.
- **P2:** should fix.
- **P3:** polish.

`(audit #n)` marks the 29 findings already confirmed in `v08-gap-audit.md`.

---

## A. Phone and PWA foundations

**C01 [P0] No `<meta name=viewport>` (audit #1).**
- **Saw:** on a Pixel 7 the page lays out at 980 px. The build-notes rail shows and text is about 40% size (`raw/01-welcome-pixel7-light.jpg`, `raw/11-solo-home-light.jpg`). The audit script measured `innerWidth = 981` on both phone profiles.
- **Why:** every phone user sees a desktop page. The existing playtest used a 400 px *desktop* viewport, so it never caught this.
- **Fix:** add `<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">`. Hide the rail below 900 px. Add a test that fails if `innerWidth ≠ device width` on the Pixel 7 and iPhone 13 profiles.

**C02 [P0] Not installable; iOS push impossible (audit #2).**
- **Saw:** `manifest.webmanifest` exists but is never linked. The only icon is `icon.svg` marked `any maskable`.
- **Why:** Android shows no install prompt. iOS needs a 180 px PNG `apple-touch-icon`, and web push on iOS only works from a Home Screen app, so pushes can never reach iPhone users.
- **Fix:**
  - Link the manifest.
  - Ship PNG icons (192, 512, maskable 512, apple-touch 180), plus `theme-color` for light and dark, and `apple-mobile-web-app-capable`.
  - Add an "Add to Home Screen" coach card shown on iOS Safari after the first good moment.

**C03 [P1] No `<!doctype html>` and no `<html lang>` (audit #3).**
- **Saw:** `document.doctype` is null and `lang` is `""` (audit JSON).
- **Why:** quirks mode (box model, table and line-height oddities), and screen readers can't pick a voice.
- **Fix:** add `<!doctype html><html lang="en">`. Set `lang` from the chosen language once i18n lands (C70).

**C04 [P1] The QR library loads from cdnjs at runtime.**
- **Saw:** `<script src="https://cdnjs.cloudflare.com/.../qrcode.min.js">` (line 296). With cdnjs blocked, the invite sheet and the Meet sheet show only the code, with no QR (`24-invite-sheet-light.jpg`, `68-meet-qr-light.jpg`).
- **Why:**
  - Third-party availability breaks the meet and invite path.
  - It blocks a strict CSP.
  - It leaks the user's IP to a CDN.
  - It can't work offline.
- **Fix:** vendor a tiny QR encoder (about 5 KB) inline. Add a CSP test that allows no external script.

**C05 [P1] Back button exits the app.**
- **Saw:** tab changes and sheets don't push history. `page.go_back()` after switching tabs went to `about:blank` and left INSANE (`live-log.json`, "after back url about:blank").
- **Why:** Android users press Back to close a sheet or go to the previous tab. Today they lose the app, including half-written forms.
- **Fix:** add a `history.pushState` route per tab, segment and sheet (`#/circle/plans`, `#/sheet/pot-new`). Back closes the sheet first. Handle `popstate`. Keep `#c`/`#m` deep links working.

**C06 [P1] Fresh scroll position isn't reset after onboarding.**
- **Saw:** right after "Start it", Arjun's Home opens scrolled mid-page. The pact card ("Done today") is cut off at the top (`22-creator-home-light.jpg`).
- **Why:** the first screen after signup starts mid-list, so people miss the most important card.
- **Fix:** `scrollTo(0,0)` on every tab change and after onboarding finishes. Keep the scroll position per tab only when returning to it.

**C07 [P2] There is no offline banner, and no offline shell.**
- **Saw:** with the context set offline, Home looks identical and nothing says the app is offline (`18-offline-light.jpg`). `sw.js` caches nothing (audit #29).
- **Why:** taps silently fail or toast "Check your connection" after the fact. A cold start with no signal shows the browser's dinosaur page.
- **Fix:**
  - Add a top banner: "Offline: you can read; changes will send when you're back."
  - Queue writes with idempotency keys.
  - The service worker precaches `index.html`, icons and `world.json`, and serves the shell cache-first with a network update.

**C08 [P2] PWA update flow is undefined.**
- **Saw:** `sw.js` calls `skipWaiting()` and `clients.claim()` with no versioning. `index.html` is `no-cache`.
- **Why:** once C07 adds caching, users will be stuck on old builds or get mid-session swaps that break state.
- **Fix:**
  - Version the cache by `BUILD_ID`.
  - Show "New version ready, tap to reload" when a new SW is waiting.
  - Have the server send `X-Insane-Build` so the client can force a reload on breaking API changes (min supported build).

---

## B. First run and sign-in

**C09 [P1] The first screen is a bare email box with no value proposition (audit #6).**
- **Saw:** "Sign in with your email · We email you a 6-digit code" and nothing else (`01-welcome-pixel7-light.jpg`, dark is the same).
- **Why:** people decide in about 5 seconds. Nothing says what INSANE is, who it's for, or why to give an email.
- **Fix:** add a welcome screen: wordmark, one-line promise ("Plans, dares and favours with the 3–8 people you actually see"), three illustrated bullets, and "Get started" plus "I have an invite".

**C10 [P1] No intro walkthrough (audit #7).**
- **Fix:** add 3–4 swipeable cards before sign-in, skippable, shown once: Circles of up to 8 → pacts and the daily dare → Midnight and the Mole → the City. Store `seenIntro` in localStorage.

**C11 [P1] The invite deep link loses context at sign-in.**
- **Saw:** Kavya opens `/#cCODE`. The sign-in screen never mentions the circle (`30-deeplink-signin-light.jpg`). The "Mylapore Mad Hatters brought you in" banner appears only *after* she has typed her email and code (`31-deeplink-ob-light.jpg`).
- **Why:** the invite is the strongest reason to sign up, and it's hidden behind the friction.
- **Fix:** add a public `GET /api/invite/:code` that returns only the circle name, member count and first names (rate-limited). The welcome screen then says "Arjun invited you to Mylapore Mad Hatters (3 of 8)".

**C12 [P2] Bad email gets only the browser's native bubble.**
- **Saw:** "not-an-email" gets Chrome's tooltip, which is gone in a second and inconsistent across browsers (`02-bad-email-light.jpg`).
- **Fix:** add an inline error under the field, plus a typo suggestion (gmial.com → gmail.com, which matters for India where gmail dominates).

**C13 [P2] The code entry field isn't optimised for OTP.**
- **Saw:** a plain text field.
- **Fix:**
  - `inputmode=numeric`, `autocomplete=one-time-code`, `maxlength=6`, autosubmit at 6 digits.
  - Paste-to-fill.
  - Resend countdown ("send another in 0:42").
  - Show which email was used, with Change (this exists already).

**C14 [P1] Email-code is the only sign-in (audit #23).**
- **Why:** in India phone OTP or Google is the norm. Email OTP also needs Resend and a verified domain before anyone outside dev can sign in.
- **Fix:**
  - Add Google Sign-In (needs Vijay's OAuth client ID).
  - Keep email-code.
  - Plan phone OTP through an Indian SMS gateway with DLT registration (needs Vijay: DLT entity, sender ID and templates).
  - The honest stand-in until then: email-code via Resend on a cheap domain.

**C15 [P3] The "Development server: codes are printed in the server log" line also shows on phones in dev.**
- **Fix:** keep it, but add a one-tap "Fill dev code" button in DEV so testers on phones aren't stuck.

---

## C. Onboarding

**C16 [P1] Onboarding progress is lost on reload (audit #11).**
- **Saw:** Meera typed her name, reloaded, and the name was `''` and she was back at step 1 (`live-log.json`).
- **Why:** on Android the OS kills the tab while people switch to their mail app for the code or to Maps to copy a link.
- **Fix:** persist `S.ui.ob` (step, name, handle, place draft, lane and text) to `sessionStorage` and `localStorage` on every input. Restore it on boot, and clear it on finish.

**C17 [P1] The age gate is a 13 px checkbox with a 16+ rule (audit #20).**
- **Saw:** the checkbox is about 13×13 px (`05-ob-name-light.jpg`), and Next is grey without saying why.
- **Why:** this is a legal problem as well as a UX one. Under India's DPDP Act a "child" is under 18, and processing a child's data needs verifiable parental consent. Section 9 and Rule 10 commence on 13 May 2027 (PIB, 14 Nov 2025; DPDP Rules Rule 10). A 16+ checkbox doesn't meet that.
- **Fix:**
  - Ask for date of birth (month and year), with 18+ in India and 16+ elsewhere by locale.
  - Make the age control a 44 px toggle row.
  - When Next is disabled, say what's missing ("Confirm you're 18 or over").
  - Store only `adult: true` plus the date of the attestation.

**C18 [P2] Step 1 copy contradicts the product: "With your five", while circles go up to 8.**
- **Saw:** `05-ob-name-light.jpg`.
- **Fix:** "With your people (3–8)".

**C19 [P2] The "Your handle" concept is unexplained and random (LATE CAB, NIGHT BUS…).**
- **Why:** people don't know it's public, can't see where it's used, and the random pick feels like a bug.
- **Fix:** add one line ("Strangers in the City see this, never your name"), a "Shuffle" button, and a preview of how a feed post looks.

**C20 [P1] Long names are silently cut, mid-word.**
- **Saw:** "Meera Krishnamurthy-Venkataraghavan 🌶️🔥" becomes "Meera Krishnamurthy-Venk" (`16-solo-you-light.jpg`). The circle name "Mylapore Mad Hatters with a very long circle name indeed" becomes "Mylapore Mad Hatters with a", which then appears as "Mylapore Mad Hatters with a brought you in" and "Post as Mylapore Mad Hatters with a" (`31-deeplink-ob-light.jpg`, `69-feed-posted-light.jpg`).
- **Fix:**
  - Use `maxlength` on the inputs, with a live counter (name 40, circle 28).
  - Trim at word boundaries server-side and tell the user.
  - Use ellipsis in the UI with CSS rather than data truncation.

**C21 [P1] RTL and mixed-script names aren't isolated.**
- **Saw:** "كافيا Kavya" renders reordered in chips and sentences ("Ask كافيا Kavya", plan chips, the timeline "Did a favor for كافيا Kavya: Help…"; `58-pot-card-light.jpg`, `76-profile-place-light.jpg`).
- **Why:** bidi bleed scrambles the surrounding punctuation and order. India has Urdu users, and the app is marketed globally.
- **Fix:** wrap every user-supplied string in `<bdi>`, or use `unicode-bidi:isolate`. Add an RTL name to the e2e fixtures.

**C22 [P2] The circle step on an invite link still leads with "Start a circle".**
- **Saw:** Kavya's step 3 shows *Start a circle* first, then *Join with a code* with the code prefilled, plus "Look around first" (`32-deeplink-circle-step-light.jpg`).
- **Fix:** when arriving with a code, show only "Join Mylapore Mad Hatters" as the primary button, with "Start my own instead" as a small link.

**C23 [P2] "Look around first" (skip) gives no idea of what's lost.**
- **Fix:** "You can join later from Circle. Most things need a circle."

**C24 [P2] The "What's on your mind" step has no examples per lane, and the "how INSANE reads it" line is in 11 px mono.**
- **Saw:** `10-ob-mind-light.jpg`, `10b-ob-mind-typed-light.jpg`.
- **Fix:** add three tappable examples per lane (Need, Want, Urge). Render the readUrge result as a chip preview in body font ("Pact · 3 a week · stake: you cook").

**C25 [P1] Gradual unlock was designed and never built (audit #12).**
- **Saw:** on day 1 a solo user gets 15 items in + (`14-solo-plus-light.jpg`), 4 City segments, and 5 Circle segments once in a circle.
- **Why:** V05/V06 simulated month one going from 76% to 85% with the reveal. Every extra concept costs attention.
- **Fix:** see PLAN WS-B. A server-computed `unlocks` set based on circle size, days since join, and met-in-person:
  - Day 0: plans, chat, pacts, daily dare, Decode.
  - Favors and pots after the first plan.
  - Midnight at 3 members.
  - Mole at 4.
  - Feed, Calls and Missions after meeting in person.
  - Drops and trails at day 3.
  - Locked items show as "Unlocks when…", not hidden.

**C26 [P1] No first-run tab tour (audit #8).**
- **Fix:** add a 4-step coach-mark tour (Home, Circle, +, City) after onboarding. It can be dismissed, replays from Help, and never covers the primary CTA.

---

## D. Home

**C27 [P1] Solo Home has no persistent invite card, and the code is shown only in a toast (audit #9).**
- **Saw:** after creating a circle, "Circle started. Send your friends the code 8JS7MY" appears as a toast. It disappears after 3.2 s and covers the cards (`22-creator-home-light.jpg`, `23-creator-circle-light.jpg`).
- **Fix:** while the circle has fewer than 3 members, the top Home card is "Bring your people in": a big code, Share (native share sheet), WhatsApp, Copy link, QR, and "2 more to unlock Midnight".

**C28 [P1] No `navigator.share` and no WhatsApp invite (audit #10).**
- **Fix:** add a `navigator.share({title,text,url})` button that falls back to `https://wa.me/?text=` and then to copy. Use prewritten text: "Join my circle on INSANE: <link> (code 8JS7MY)".

**C29 [P2] "1 thing today" sits above "Nothing on the go" (audit #16).**
- **Saw:** Kavya's Home shows "1 thing today" while the first card says "Nothing on the go" (`33-joiner-home-light.jpg`).
- **Fix:** derive the count from the list actually rendered. Name what it counts ("1 thing needs you").

**C30 [P1] Home priority order buries what needs action.**
- **Saw:** for Kavya the plan she must answer (**Needs you · I'm in / Can't**) is the *last* card and is cut off by the tab bar. Above it: Nothing-on-the-go, Decode, Daily dare, "New in your circle" (`51-kavya-home-plan-light.jpg`). For Arjun, the favor he claimed sits below the pact, Decode and dare (`55-arjun-home-needs-light.jpg`).
- **Fix:** order Home as:
  1. Needs you (time-bound: plans to answer, pots to pay, favors to confirm, dares sent to you).
  2. Today's own items (pact ticks).
  3. Daily dare.
  4. Decode.
  5. Circle news.
  6. Drops.
  
  Add a test asserting the order.

**C31 [P2] The footnote "One list. Whatever needs you today…" is hidden behind the tab bar.**
- **Saw:** `11-solo-home-light.jpg`. The last line sits under the fixed nav.
- **Fix:** `padding-bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 16px)` on `#app`.

**C32 [P2] Empty "No drops within 5 km yet" uses a dashed border and mono text that looks disabled, but it's a CTA for shops.**
- **Fix:** collapse it to one line ("No drops nearby · Host one") for non-shop users. Show the full pitch only in City → Map.

**C33 [P2] The Decode card's puzzle text is the largest, heaviest type on Home.**
- **Saw:** a 3-line bold 20 px question (`11-solo-home-light.jpg`).
- **Why:** it competes with the primary actions.
- **Fix:** show a one-line teaser ("Decode · week 42 · 0 solved in Chennai"), with the full clue in the sheet.

**C34 [P2] There's a red dot on City for a brand-new solo user who has nothing new.**
- **Saw:** `11-solo-home-light.jpg`, `12-solo-circle-light.jpg`.
- **Fix:** dots only for unseen items addressed to you. Never show one on first launch.

---

## E. Circle

**C35 [P1] No circle admin (audit #18).**
- **Saw:** there's no way to remove a member, rename, transfer ownership or close a circle.
- **Why:** a circle with an abusive or ex member is stuck forever.
- **Fix:** add owner/admin roles and remove (with a 24 h undo), rename, transfer, close, and rotating the invite code. All of these are enforced server-side.

**C36 [P1] One circle per person (audit #25).**
- **Saw:** "You're already in a circle. Leave it first to join".
- **Why:** family, flatmates and friends is the normal Indian case.
- **Fix:** allow up to 3 circles, with a circle switcher in the header. The ledger and pots stay per circle. This needs a data migration (C83).

**C37 [P0] Midnight's "names are blocked" rule is client-only and misses first names.**
- **Saw:** Arjun queued "Kavya, you are the funniest person here". It was accepted ("Queued for midnight. Unsigned.", `64-midnight-name-blocked-light.jpg`) because Kavya's stored name is "كافيا Kavya". The regex matches only the full name string, client-side (line 1825). The server keeps `text` as given (server.js line 120).
- **Why:** this is the core safety promise of Midnight ("about yourself; gossip hurts 5×"), and it's trivially bypassed: first names, nicknames, or a hand-made API call.
- **Fix:** run a server-side check on release and on write. Tokenise every member's name into parts of 2 or more letters, plus handle, plus transliteration-insensitive matching (NFKD, case-fold). Refuse with `names_blocked`. Add property test P07.

**C38 [P2] The Chat composer floats mid-screen with a big gap, and there are no message states.**
- **Saw:** `50-plan-thread-light.jpg`. The input sits halfway down, and there's no sending / sent / failed indicator.
- **Fix:**
  - Dock the composer to the bottom above the tab bar, using `visualViewport` so the keyboard doesn't cover it.
  - Show a per-message status.
  - Allow retry on failure.

**C39 [P2] Plan cards don't show time in a scannable way, and you can't add the plan to a calendar.**
- **Fix:** add a date chip ("Sun 19 Oct · 6:00"), "Add to calendar" (an .ics data URL), and a map link for "where".

**C40 [P2] Pacts: the 20 tiny squares under a 3-a-week pact are unexplained.**
- **Saw:** `55-arjun-home-needs-light.jpg`.
- **Fix:** show a week strip (M T W T F S S) with ticks and the two free misses, plus a tooltip.

**C41 [P2] Mole and Midnight "needs N" exists only inside each segment; the segments themselves don't show a lock (audit #13).**
- **Saw:** Mole says "starts once four of you are in the circle. 3 so far" (`65-mole-3people-light.jpg`), but the tab looks active.
- **Fix:** segment chips show a lock and "4+" when unavailable, with a single "Invite 1 more" CTA inside.

**C42 [P3] The circle avatar row: a self-avatar letter mismatch ("Y" for You in "What everyone's on" vs "A" in the header), and the "+" add-person circle is 36 px.**
- **Fix:** use one avatar component with a 44 px target.

---

## F. City

**C43 [P1] On mobile the City map is below the fold.**
- **Saw:** header copy, segment tabs and the full Decode card push the map down. Only about 40% of the map is visible, and drops are under it (`72-city-map-light.jpg`).
- **Fix:** see section J. Map-first layout with a bottom sheet list, and Decode moved to Home or League.

**C44 [P1] The City map shows circle members by name at their square centre ("Ravi").**
- **Saw:** a black dot labelled "Ravi" on Arjun's map (`72b-city-map-full-light.jpg`).
- **Why:** it's only a 1 km² cell centre, but a labelled dot reads as "Ravi lives here". Members never opted in to being on the map, and combined with "here now" it's a stalking surface.
- **Fix:** don't plot people by default. Add an opt-in "Show me to my circle on the map" with the square drawn, never a dot. Never plot other circles.

**C45 [P2] Calls: "Posted." toast, but the list still says "No open calls in Chennai".**
- **Saw:** `70-calls-light.jpg`. Your own call isn't listed (because you can't answer it), so it looks like it failed.
- **Fix:** add a "Your circle's calls" section showing your open call, with its status and Close.

**C46 [P2] Feed actions "Hide" and "Report" are 12 px text links. Reactions are 28 px pills. "Delete" on your own post is a bare word.**
- **Saw:** `13-solo-city-feed-light.jpg`, `69-feed-posted-light.jpg`.
- **Fix:** put them in a 44 px overflow menu (⋯) with Report / Hide / Block circle. Make reactions 44 px.

**C47 [P2] League: an empty table with a dense paragraph of rules.**
- **Saw:** `71-league-light.jpg`.
- **Fix:** show a points table with icons, "Your circle: 0 · next: solve Decode +10", and the rules behind an (i).

**C48 [P0] The Decode answers ship in the page (audit #4).**
- **Saw:** `const ANS=['WATERLOO',…]` at line 539. The live run confirms "ANS in client source: True".
- **Why:** the server-side check is moot; view-source gives every week's answer.
- **Fix:** the server holds the puzzles. The client gets only the clue for the current week and city. The answer is checked by `/api/decode/solve`. The claude.ai artifact mode keeps a hashed answer (`sha256(salt+answer)`, compared client-side) and is labelled "honour system".

**C49 [P2] When tiles fail, the map is blank, with no fallback.**
- **Saw:** with tile.openstreetmap.org unreachable, the place picker and host-drop maps are flat grey or white with a pin (`08-ob-place-picked-light.jpg`, `15-solo-mk-drop-light.jpg`).
- **Fix:** on tile error, fall back to the bundled vector world plus the place labels already used in claude.ai mode. Show "Street map unavailable".

**C50 [P2] Drop draws are predictable before they run.**
- **Saw:** `drawWinner` = `fnv(drop.id + sorted circles)` (line 558).
- **Why:** anyone can compute the winner as circles check in. The last circle to arrive can decide whether to check in based on whether it would win, and a host can re-roll the drop id.
- **Fix:** commit-reveal. At creation the server publishes `H(seed)`. After close it reveals `seed`, and the winner is `fnv(seed + sorted circles)`. Anyone can still verify. Add property test P10 and a differential test.

**C51 [P2] Missions and trails forms are long single scrolls with a third copy of the place picker.**
- **Saw:** `74-mission-form-light.jpg`, `75-trail-form-light.jpg`.
- **Fix:** a 3-step wizard (What → Where → When), and one shared picker component (section J).

---

## G. Ledger

**C52 [P1] Pots in India default to "paypal.me/you", with no UPI.**
- **Saw:** the pot form's "How to pay you" placeholder is `paypal.me/you` and the pay methods are bank transfer, PayPal, Revolut and cash (`57-pot-form-light.jpg`, V08.md).
- **Why:** UPI is how Indians pay each other.
- **Fix:**
  - When the currency is INR, offer "UPI ID" with validation (`name@bank`).
  - Add a "Pay by UPI" button that opens `upi://pay?pa=<vpa>&pn=<name>&am=<amount>&cu=INR&tn=<pot>`. INSANE still never holds money.
  - Show a QR of the same URI on desktop.
  - Keep the organiser-confirms rule.

**C53 [P2] Pot amounts render as "₹1500", not "₹1,500".**
- **Saw:** `58-pot-card-light.jpg`.
- **Fix:** `Intl.NumberFormat(locale,{style:'currency',currency})`, which also handles the lakh grouping (₹1,50,000).

**C54 [P2] The favor balance explainer is 4 lines of 11 px mono.**
- **Saw:** `56-ledger-after-light.jpg`.
- **Fix:** one line ("+2 h means people owe you time. Limit −5 h") with (i) for the rest. Colour the balance (green +, red −) with a sign that doesn't rely on colour alone.

**C55 [P2] The "LOGGED" stamp animation overlays the action buttons.**
- **Saw:** it sits on top of "Ask a favor / Someone helped me" (`56-ledger-after-light.jpg`).
- **Fix:** anchor the stamp to the favor row that changed. Use `pointer-events:none` and respect `prefers-reduced-motion`.

**C56 [P2] Solo Ledger is a dead end.**
- **Saw:** two segment tabs and a mono line "Favors and pots happen inside a circle" (`12-solo-ledger-light.jpg`).
- **Fix:** an illustrated empty state explaining favors in hours and pots, plus "Start or join a circle". Or, with gradual unlock, hide the Ledger tab until a circle exists and replace it with "Help".

---

## H. The + menu

**C57 [P1] 15 flat text rows, with no grouping, icons or lock state.**
- **Saw:** `14-solo-plus-light.jpg`. A solo user can tap "Start a pot". The sheet closes and drops them on Ledger with "Favors and pots happen inside a circle", with no explanation (`15-solo-mk-pot-light.jpg`). "Propose a Mission" tells a circle-less user to "Meet someone" (`15-solo-mk-mission-light.jpg`).
- **Fix:**
  - Group into **With your circle** (plan, pot, favor, dare, Midnight, seal), **For you** (check in, go dark, add a need/want/urge) and **In the city** (post, call, drop, Mission, trail, meet).
  - Add icons.
  - Locked rows show the unlock rule inline and open the right next step (Invite / Meet).
  - Show at most about 6 rows on day 1 (C25).

---

## I. Profile, settings and account

**C58 [P1] Notification permission is buried in Profile (audit #15).**
- **Fix:** ask in context, right after the first plan, pact or favor ("Want to know when they answer?"). Use a soft-ask card first, then the OS prompt. On iOS, explain that it needs Add to Home Screen first (C02).

**C59 [P1] Delete account keeps you signed in and drops you straight back into onboarding.**
- **Saw:** after "Delete for good", Ravi sees "You're signed in as ravi@x.com" and step 1 again (`83-after-delete-light.jpg`).
- **Why:**
  - Deletion is a loop of client-side doc deletes (line 1970).
  - The server's account, session and OTP rows remain.
  - Messages keep the name.
  - A half-finished client delete leaves orphans.
- **Fix:**
  - A server-side `POST /api/account/delete` that runs in one transaction: profile, private space, posts, progress, membership, sessions and push subscriptions.
  - Messages are re-signed as "Former member".
  - Then sign out and show a confirmation page.
  - Under DPDP, also send an erasure confirmation email.

**C60 [P2] No change-email, no list of signed-in devices, no "sign out everywhere" (audit #24).**
- **Fix:** a Sessions table in Profile (device, city, last seen) with Revoke, and change-email via a code sent to the new address.

**C61 [P2] Go dark relies on the phone clock; a 14-day server clock jump still showed "59:55".**
- **Saw:** `80-day14-home-light.jpg`.
- **Why:** a phone with a wrong clock stays dark or ends early.
- **Fix:** compute the remaining time from server `now` (already sent in `/api/hello`) plus a monotonic offset.

**C62 [P2] Export downloads JSON only.**
- **Fix:** export also produces a human-readable HTML or PDF summary. Include messages you wrote and the ledger.

**C63 [P1] No Terms, Privacy Policy, community rules or grievance contact (audit #21).**
- **Why:** DPDP requires an itemised notice, purpose, a grievance redressal response within ≤90 days, and a contact. Dares need a liability line.
- **Fix:** add `/legal/terms`, `/legal/privacy` and `/legal/rules` pages, linked from welcome, onboarding consent and Profile. Make consent an explicit checkbox stored with a version and timestamp. Name a grievance officer (needs Vijay: name and email).

---

## J. Map and location UX (the place picker and City map, evaluated against the goal)

**Goal:**
- Places are private by default.
- Drops show only within the radius you chose.
- A Mission's exact spot stays hidden until 2 h before.
- Trails are stamped by GPS.

**C64 [P1] The place picker opens on Africa (Kinshasa, Nairobi) for a user in Chennai.**
- **Saw:** `06-ob-place-light.jpg`. The initial view ignores the timezone, locale and IP.
- **Fix:**
  - Centre on a guess from `Intl.DateTimeFormat().resolvedOptions().timeZone` (Asia/Kolkata → India). Use the server's IP country header too, if behind a CDN.
  - Pre-fill the search with the guessed city's name greyed out.

**C65 [P1] Three ways to set a place (search, GPS, paste link) plus tap-the-map, with no hierarchy.**
- **Saw:** `06-ob-place-light.jpg`, `20-arjun-gps-light.jpg`.
- **Fix:** one primary button, **"Use my location"**, then "or search". Fold paste-a-link into the search box (detect a URL). Map taps move the pin once a pin exists.

**C66 [P1] There's no live preview of what others see that is honest about the Exact mode.**
- **Saw:** in Exact mode the map still draws a large pink square around the pin (`21-arjun-exact-light.jpg`). The "What other people see" box is below the fold.
- **Fix:** a split preview toggle, **You see** (pin) / **Others see** (blurred 1 km² square, label "near Chetput"), rendered on the same map. Default to **Zone 1 km²** (already the default: good). Explain Exact in one line: "Only you can see the pin; it makes distances to drops exact".

**C67 [P2] Search results are noisy.**
- **Saw:** "Minjur" returns "Mīnjūr · Tamil Nadu" plus two "street search" rows ("Foot over bridge, Venkatareddypalayam") (`07-ob-place-search-light.jpg`).
- **Fix:** collapse street hits under "More precise places". Show a type icon (town / neighbourhood / street) and a distance from the guessed location.

**C68 [P2] Map controls are 36 px, there is no visible pinch hint, labels clip at edges ("onneri", "Chi…"), and the legend is 10 px mono.**
- **Saw:** `12-solo-city-light.jpg`, `72-city-map-light.jpg`.
- **Fix:** 44 px controls, label collision and edge padding, legend chips in body font, and gesture handling (two-finger pan inside a scrolling page, a full-screen map button).

**C69 [P1] Tile provider: tile.openstreetmap.org forbids heavy or commercial-scale app use (audit #29).**
- **Why:** the OSMF Tile Usage Policy is best-effort with no SLA, may block without notice, and forbids offline/prefetch (https://operations.osmfoundation.org/policies/tiles/).
- **Options checked 17 Oct 2026:**
  - **Stadia Maps** free: 200,000 credits a month, 1 credit per tile, non-commercial only. Starter is $20 a month for commercial use (https://stadiamaps.com/pricing/).
  - **MapTiler** free: 5,000 sessions and 100,000 requests a month, non-commercial, with a logo (https://www.maptiler.com/cloud/pricing).
  - **Protomaps:** a self-hosted PMTiles extract (India or a city) on Cloudflare R2 or Render static. No per-tile fees, offline-friendly.
- **Recommendation:**
  - **Protomaps with an India extract** as the default. It's free at any scale, works offline in the SW, and has no third-party IP leak.
  - Keep `TILE_URL` configurable. Stadia is the hosted fallback for non-India cities during the test.
  - Add a `User-Agent`/Referer-correct attribution "© OpenStreetMap contributors".

**Proposed map design (detailed in PLAN WS-F):**
- **City tab:** map first, full width, 60% of the screen height. A draggable bottom sheet with a **List / Map** toggle. **Distance chips** (2 · 5 · 10 · 25 km) above the sheet. Clustering of drops at low zoom. A "Near you" list sorted by distance with "2.3 km · opens 18:00".
- **Places:** your home is a soft square, never a dot, even to you, unless Exact (then the pin is only on your device). Other people are never plotted (C44).
- **Missions:** a 350 m nudged circle until T−2h, with a countdown chip "spot revealed in 3h 12m". After the reveal, a pin only for people who said yes.
- **Trails:** numbered stops, a dashed line, "Stamp" enabled only within 60 m (GPS accuracy shown), and "on your word" clearly marked.
- **One shared picker component** for onboarding, Profile, host-drop, Mission and trail stops.

---

## K. Visual design and contrast

**C70 [P2] Secondary text is mono at 10–11 px everywhere (explainers, rules, legends, timestamps).**
- **Saw:** the minimum font in the audit was 9–10 px on several screens (`76-profile-place`, `80-day14-home`).
- **Why:** it's hard to read outdoors on a phone and looks like debug output.
- **Fix:** body font at 13 px minimum for secondary text. Keep mono for codes and numbers only.

**C71 [P2] Primary CTAs aren't distinguished.**
- **Saw:** "Start or join", "Climbed rung 1", "Host a drop" and "Add one" all look the same weight (dark pill or outline) (`11-solo-home-light.jpg`). In dark mode the primary is a light pill and the secondary an outline, but disabled "Next" is a mid-grey pill that looks like a primary (`05-ob-name-dark.jpg`).
- **Fix:** one filled primary per screen in `--stamp` (red), secondary outline, tertiary text. Disabled state gets reduced contrast plus a reason line.

**C72 [P2] Cards don't separate from the background.**
- **Saw:** in light mode `--card #F9FAF6` on `--paper #ECEEE7` is about 1.1:1, with hairline borders. Dashed "empty" cards look like disabled ones (`11-solo-home-light.jpg`, `13-solo-ledger-pots-light.jpg`).
- **Fix:** raise the card contrast (white card with a subtle shadow, or a darker paper). Reserve dashed borders for drop zones only.

**C73 [P1] Toasts are big pills that overlap content and persist across screens (audit #16).**
- **Saw:** a 3-line "Circle started…" toast covers cards (`22-creator-home-light.jpg`). "You're in." from the Circle tab is still showing on Ledger (`53-favor-form-light.jpg`). "Posted." covers the first feed card (`69-feed-posted-light.jpg`).
- **Fix:**
  - A one-line snackbar above the nav, max 2 lines, auto-dismiss in 3 s, cleared on navigation.
  - Never put information that has to be kept (a code) in a toast.
  - `role=status`.

**C74 [P3] The header's top-right block is 4 pieces of 10 px mono (dot, circle name, city, square size) next to a 32 px avatar.**
- **Saw:** every screen.
- **Fix:** the circle name in the header (with a switcher once C36 lands). Location moves to Profile. The avatar is 44 px.

**C75 [P3] Dark mode is mostly good.**
- **Saw:** the magenta daily-dare card is the strongest element in both themes. But the dark-mode "disabled" grey and the active segment chip are close in tone (`13-solo-ledger-pots-dark.jpg`), and the Go dark screen ignores light mode (fine, by design).
- **Fix:** add a design token audit with WCAG contrast checks in CI (C79).

---

## L. Accessibility

**C76 [P1] Tap targets under 44 px are pervasive.**
- **Saw:** the audit counted, out of all interactive elements: 22/22 small on the place step, 35/41 on Edit profile, 29/35 on the dare sheet. Typical: chips 32 px, "Climbed rung 1" 138×32, bell 30×30, avatar 32×32 (`live-log.json`, audit block).
- **Fix:** `min-height:44px; min-width:44px` on `.btn`, `.chip`, `.seg button` and icon buttons. Add a test that asserts 0 targets under 44 px on key screens.

**C77 [P2] Icon-only controls have weak names.**
- **Saw:** the bell, avatar and map +/−/◎ have no visible labels. Some have no `aria-label`.
- **Fix:** add `aria-label`s, `aria-expanded` on sheets, and a focus trap plus focus return on sheet close.

**C78 [P2] No visible focus ring, and sheets don't trap focus.**
- **Fix:** `:focus-visible` outline in `--ball`. Focus goes to the sheet heading on open and returns on close. Escape closes (already works).

**C79 [P2] No automated a11y checks.**
- **Fix:** vendor axe-core (about 500 KB, test-only, MIT) or write a small contrast and target checker (the one in `tools/livetest` is a start). Run it on golden screens in light and dark.

**C80 [P3] Reduced motion is respected only for `.pulse`. The draw spinner, LOGGED stamp, confetti and breathing circle animate regardless.**
- **Fix:** gate all keyframes behind `prefers-reduced-motion: no-preference`.

---

## M. Performance

**C81 [P1] `places.tsv` (2.7 MB raw, 1.35 MB gzipped) is downloaded again on every page load and every picker open.**
- **Saw:** the network log shows `/data/places.tsv` fetched 3–4× per persona session (`live-log.json` → `net.big`). The cache is `max-age=86400`, but each new context re-downloads it. On Indian mobile data that's 1.35 MB × every cold start.
- **Fix:**
  - Don't load the world list on phones in server mode. Server search (`/api/geo`) already exists and returned results in about 1 s on throttled 3G.
  - In artifact mode, split by country (`places/IN.tsv` about 60 KB) and load on demand.
  - `Cache-Control: immutable` with a hashed filename.

**C82 [P2] `index.html` is 275 KB (86 KB gzipped) of inline JS and CSS, parsed on every load.** The 18 MB of vector tile JSON in `app/data/t` is fetched per view in artifact mode.
- **Fix:**
  - Measure TTI on a Moto G-class profile.
  - Lazy-render offscreen segments.
  - In server mode serve tiles from the provider (C69).
  - Keep the single-file artifact through a build step (PLAN §2).

---

## N. Security and privacy

**C83 [P1] No data migration story from v0.8 to v0.9 stores.**
- **Why:** multiple circles (C36), server-held Decode (C48), roles (C35), unlocks (C25) and consent records (C63) all change the document shapes. Both the SQLite store and the claude.ai shared store hold v0.8 data.
- **Fix:** add a `schemaVersion` doc and idempotent, ordered migrations run on server boot, plus an artifact-mode client migration with backup first. Add a test: load the v0.8 fixture DB → migrate → run v0.9 e2e.

**C84 [P1] Rate limits exist only on geo search and OTP (audit #29).**
- **Saw:** `limited()` is used twice in server.js.
- **Why:** any signed-in client can flood posts, messages, favors and checkins. A spam call or post fan-out also triggers push to everyone.
- **Fix:** per-uid token buckets per route class (writes 60/min, posts 10/h, calls 5/day, pushes coalesced). Add a body size cap (no `MAX_BODY` today). Return `resource_exhausted`.

**C85 [P2] Session cookie and headers need a production review.**
- **Fix:** confirm `Secure; HttpOnly; SameSite=Lax`. Add `Content-Security-Policy` (no external script once C04 lands), `Referrer-Policy: strict-origin-when-cross-origin` (still sends the Referer OSM needs), `Permissions-Policy: geolocation=(self)` and HSTS behind TLS.

**C86 [P2] The claude.ai artifact mode hides secrets "only by the page" (Decode, unopened Midnight, Mission spots).**
- **Fix:** keep labelling it, but hash answers and spots client-side (sha256 with a per-item salt) so view-source doesn't reveal them. Plaintext only arrives at reveal time from the author's device.

---

## O. Safety and trust

**C87 [P0] No block or report for a person (audit #17).** Only feed posts can be reported.
- **Fix:** Block (hides them from you, prevents DMs and dares to you, removes them from your map and rooms) and Report a person or message with a category. The block list is enforced server-side.

**C88 [P1] No "this dare isn't safe" flag on the daily dare, jar dares or dares sent to you (audit #19).**
- **Saw:** the jar caps at 6/10 and has a written rule (`66-dare-sheet-light.jpg`), but nothing is enforced. The scale says "out of 10" while offering 1–6, which is confusing.
- **Fix:**
  - A ⚑ "Not safe" on every dare. One flag hides it for you; 2 flags pull it from the jar for the circle; owner review.
  - A server-side keyword screen (traffic, fire, heights, alcohol, strangers' bodies, police, money) refuses with a reason.
  - Relabel the scale as "How bold (1–6)".

**C89 [P1] No owner moderation view (audit #22).**
- **Fix:** an owner-only `/admin` screen: flagged posts, dares, Midnight removals, person reports, Missions awaiting review. Actions are logged to an audit table.

**C90 [P2] The "Here now" presence plus a square on the map plus a public handle could identify people.**
- **Fix:** presence is visible to the circle only, can be turned off in Profile, and is never shown in the City.

---

## P. Content

**C91 [P1] Only 8 Decode puzzles, London-flavoured (Waterloo, Big Ben), served to Chennai (audit #27).**
- **Fix:** move puzzles server-side (C48), with city packs. Seed India packs (Chennai, Bengaluru, Mumbai, Delhi): 12 each. Fall back to a global generic set. Add an owner content tool (C93).

**C92 [P2] 8 starter dares and 8 Mole tasks, so they repeat within 2 weeks (audit #27).**
- **Fix:** 60 starter dares across 6 levels, safety-reviewed, with locale tags (no "pub" in India-dry contexts). 30 Mole tasks. Never repeat within 30 days per circle.

**C93 [P2] No owner content tool (audit #27).**
- **Fix:** `/admin/content` for puzzles, dares, Mole tasks and seed drops per city, with a preview and a schedule.

**C94 [P3] Unbuilt v0.6 items: Zones/fixtures, Chapters, vouch and Reliability, 15 s video clips (audit #28).**
- **Fix:** keep them out of v0.9 scope. Document why in the plan:
  - Zones need venue partners.
  - Video needs object storage and moderation.
  - Chapters need block/report first.

**C95 [P2] English only (audit #26).**
- **Fix:** extract strings into a `T{}` table now, with English as the source. Add Tamil and Hindi in v1.0 with native review. Format dates and currency by locale today.

---

## Q. Server and ops

**C96 [P0] No deploy config (audit #29).**
- **Saw:** no Dockerfile, render.yaml or package.json.
- **Fix:** `package.json` (`engines.node >=22`, scripts), a `Dockerfile` (node:22-slim), and `render.yaml` with a persistent disk for SQLite, a health check at `/api/hello`, and env vars (`PUBLIC_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `TILE_URL`, `VAPID_*`, `OWNER_EMAIL`, `SENTRY_DSN`).

**C97 [P0] SQLite has no backup.**
- **Fix:**
  - Nightly `VACUUM INTO` snapshot plus hourly WAL copy to object storage (R2/S3).
  - A restore script tested in CI.
  - Point-in-time rollback documented.

**C98 [P1] No error monitoring.**
- **Fix:** Sentry on client (`window.onerror`, unhandledrejection) and server, with a release tag = `BUILD_ID`, no PII, IP scrubbed. (Vijay already has a Sentry account.)

**C99 [P1] No rollback or release process.**
- **Fix:**
  - Tag releases.
  - Render deploys pinned to a tag.
  - The DB migration must be backwards-compatible for one release (expand → migrate → contract).
  - A "min client build" header (C08).

**C100 [P2] The `node:sqlite` ExperimentalWarning prints on every start.**
- **Fix:** pin a tested Node 22.x. Suppress with `--no-warnings=ExperimentalWarning`. Track node:sqlite stability.

**C101 [P2] No analytics funnel.**
- **Why:** v0.9 needs to know where people drop out: welcome → email → code → name → place → circle → first action → day-1 return → invite sent → invitee joined.
- **Fix:** first-party, privacy-preserving event counts (no third party, no IDs beyond a daily-rotating hash), shown in the owner Stats view. Respect DPDP purpose limitation.

**C102 [P2] Timezones: Midnight and quiet hours use the device's local time. The Mole reveal is "Sunday 21:00" per circle, but the circle may span zones.**
- **Fix:** store the circle's timezone (the creator's, editable). Use it for Midnight, Mole and weekly resets. Show "00:00 Chennai time" in copy.

---

## R. Tests

**C103 [P1] Tests hardcode `/opt/pw-browsers/chromium` and `/opt/node22/lib/node_modules/playwright`.**
- **Saw:** `app/test/e2e.js:4,16`, `server/test/playtest.js:8,126`. Neither runs in this sandbox or on CI without edits.
- **Fix:** resolve Playwright with `require.resolve` from the local `node_modules` or `PW`. Find Chromium from `CHROME`, Playwright's bundled browser, `/usr/bin/chromium`, then `google-chrome`. Run everything with one `npm test`.

**C104 [P1] Tests use fixed sleeps (151 `wait(…)` calls), including two `wait(21000)`, and a 400 px desktop viewport.**
- **Why:** the suite is slow (minutes), flaky, and blind to real-phone bugs (C01).
- **Fix:**
  - Condition waits (`waitForFunction`, SSE event hooks).
  - A server `/api/dev/tick` to run sweeps on demand instead of waiting 20 s.
  - Fake clocks.
  - Device profiles.

**C105 [P1] No property-based tests, differential tests or golden screenshots.**
- **Fix:** PLAN §5.

**C106 [P2] The test fixtures are all ASCII, short-name, Western cities, plus Tokyo and Lagos.**
- **Fix:** add India personas, RTL, emoji, 40-character names, and INR pots.

---

## S. Copy and help (added from the audit)

**C107 [P2] On the server version the build-notes rail shows claude.ai copy (audit #5).**
- **Saw:** "Invite each person by email from the Share menu" in the desktop rail (`raw/40-desktop-signin-light.jpg`, `raw/41-desktop-home-light.jpg`).
- **Fix:** make the rail copy depend on `S.backend`. In server mode, replace the rail with a short "About INSANE / Help" panel, and hide it in production.

**C108 [P1] No help or glossary for about 15 invented nouns (audit #14).**
- **The nouns:** pact, ladder, Mole, Midnight, Decode, drop, two-key, trail, Mission, Call, League, pot, favor-hours, passport, journey, go dark, handle.
- **Fix:**
  - A "What's this?" (i) next to each heading opens a two-line explainer.
  - A Help page in Profile with the glossary, "how unlocks work", the safety rules and a contact.
  - The first appearance of each noun gets a one-time tooltip.

## Summary by severity

| Severity | Count | Critiques |
|---|---|---|
| P0 | 7 | C01, C02, C37, C48, C87, C96, C97 |
| P1 | 44 | C03–C06, C09–C11, C14, C16, C17, C20, C21, C25–C28, C30, C35, C36, C43, C44, C52, C57–C59, C63–C66, C69, C73, C76, C81, C83, C84, C88, C89, C91, C98, C99, C103–C105, C108 |
| P2 | 51 | C07, C08, C12, C13, C18, C19, C22–C24, C29, C31–C34, C38–C41, C45–C47, C49–C51, C53–C56, C60–C62, C67, C68, C70–C72, C77–C79, C82, C85, C86, C90, C92, C93, C95, C100–C102, C106, C107 |
| P3 | 6 | C15, C42, C74, C75, C80, C94 |
| **Total** | **108** | All 29 audit findings are covered (some span several critiques); the rest are new from the live test and code review |

Every critique maps to a fix, a workstream and an acceptance test in [PLAN-V09.md](PLAN-V09.md).
