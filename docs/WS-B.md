# WS-B: first run, onboarding, unlocks, help (v0.9)

Workstream B of [PLAN-V09](PLAN-V09.md) §3.

## What a new person sees

1. **Welcome** (C09). It shows the wordmark and the promise "Plans, dares and favours with the 3–8 people you actually see", three bullets, **Get started**, **I have an invite** (an inline code box), and on the server **Already on INSANE? Sign in**.
2. **Intro** (C10). Four cards: Circles of up to 8 → Pacts and the daily dare → Midnight and the Mole → The City.
   - You can swipe, tap Next or Skip.
   - It shows once per device (`localStorage.insane_intro`).
   - On a later visit the app goes straight to sign-in or onboarding.
3. **Invite preview** (C11, C22). A `#cCODE` link opens on "Arjun invited you to Mylapore Mad Hatters (3 of 8)" with one primary button, **Join Mylapore Mad Hatters**.
   - Signed out, the preview comes from `GET /api/invite/:code`. It returns `{name, count, max, by}` only: the creator's first name, no email or uid. It's rate-limited to 30 a minute per address, and an unknown code gets a 404.
   - The hash stays in the URL, so the reload after sign-in still carries it.
   - On the circle step only **Join X** is shown. "Start my own instead" is a link.
4. **Sign-in** (C12, C13, C15). This moved from `70-shell.js` to `68-welcome.js`.
   - A bad email gets an inline error instead of a browser bubble. Typos are caught with a fix offered (gmial.com → gmail.com, plus yahoo.co.in, rediffmail and other common domains).
   - The OTP box takes digits only and fills from a paste like "123 456". Six digits submit on their own.
   - Resend waits 30 s with a countdown.
   - On a DEV server there's a **Fill dev code** button.
   - The step and email survive a tab kill (`sessionStorage.insane_si`).
5. **Onboarding** (C16–C19, C23, C24).
   - **Step 1:**
     - "With your people (3–8)".
     - A name counter.
     - A handle line ("Strangers in the City see this, never your name"), with **Shuffle** and a preview of a City post.
     - Month and year of birth as two 48 px selects (C17). India (Asia/Kolkata or a `-IN` locale) needs 18+, everywhere else 16+. Because we only have month and year, you count as N from the first day of the month after your Nth birthday month.
     - If you're too young, the screen explains the DPDP reason and Next stays off. Next always says what's missing.
     - Only `data/users/{uid}/age = {adult:true, min, at}` is stored, never the birth date.
   - **Draft** (C16): step, name, handle, age answer, lane, words and circle choice go to localStorage and sessionStorage. The picked place goes to sessionStorage only. Everything is restored on boot and cleared on finish.
   - **Skip** now says "You can join later from Circle. Most things need a circle."
   - **Step 4** has India-friendly examples (₹, not £). The read shows as one chip in body type.
6. **Tour** (C26). Four coach marks after onboarding (Home, Circle, +, City), shown above the tab bar and never over the main button.
   - Skip or Done saves `insane_tour=done`.
   - It replays from Help or Profile.
7. **Notification soft-ask** (C58). A card after the person's first plan, favour ask, or pact started after onboarding: "Want to know when they answer?" → Turn on (the OS prompt) or Not now (remembered).
   - It never appears during onboarding.
   - On iPhone outside the Home Screen it explains Add to Home Screen instead.
   - It appears only where push works (server mode).

## Gradual unlock (C25, `96-unlock.js`)

`unlocks(ctx, prev)` is pure. `ctx` is `{circle, members, days, met, plans}`.

| Unlocks | When |
|---|---|
| check-in, go dark, add a need/want/urge, meet, pacts, daily dare, Decode | day 0 |
| chat, plans, invite | in a circle |
| dare someone | 2 people |
| favors, pots | after the circle's first plan |
| Midnight, sealed messages | 3 people |
| Mole | 4 people |
| feed posts, Calls, Missions | the circle has met in person |
| drops, trails | day 3 |

Rules for the unlock set:
- Nothing re-locks. The set is kept per person on the device (`insane_unl_<uid>`), so a circle dropping from 4 to 3 keeps the Mole.
- `unlockCtx()` reads the context from state. A server-computed set (WS-I) can replace it without touching the callers.
- `localStorage.insane_unlock_all=1` (or `?unlock=all`) opens everything. Only the v0.8 e2e ports use it.

Where the locks show:
- **The + menu** (C57) is grouped into With your circle, For you and In the city, with icons.
  - It lists only unlocked rows (5 for a solo user on day 1) and a line "N more unlock as your circle grows · How unlocks work".
  - A solo user gets "Start or join a circle" first.
- **Locked Circle tabs** show "3+" or "4+" and open a lock card, for example "Opens when your circle has 3 people. You have 1, so 2 more to go", with **Bring someone in**.
- **Locked Ledger tabs** wait for the first plan.
- **The solo Ledger** (C56) explains favours in hours and pots, with "Start or join a circle".

## Help (C108, `97-help.js`)

- `GLOSS` has 23 two-line explainers, covering all 17 nouns from the audit.
- A **?** sits next to noun headings: eyebrows and the daily-dare label, added by a string pass in `draw()`. A one-line explainer sits under each Circle, City and Ledger segment row.
- An unseen **?** carries a dot until it's opened once.
- The **Help** sheet has the glossary, how unlocks work (each lock with its rule), staying safe, contact and Replay the tour. It's reachable from the + menu, Profile, every lock card and every explainer.

## Hooks in files other workstreams own (one line each)

- `70-shell.js` (WS-A):
  - `view()` calls `welcomeGate()` before sign-in and onboarding.
  - `softAskHtml()` sits after the header.
  - `draw()` runs `helpMarks()`.
  - `signin()` and `siCall()` moved out.
- `78-sheets/00-layer.js`: `tourHtml()`.
- `73-circle.js` (WS-C): `segLockTag`, `segHelp`, and `lockPanel` for locked segments.
- `74-city.js`: `segHelp`.
- `75-ledger.js` (WS-G): `soloLedger`, `segHelp`, and `lockPanel`.
- `76-you.js` (WS-D): `helpEntry()`.
- `90-actions/you.js`: the `si-*` handlers moved to `68-welcome.js`.
- `90-actions/plus.js`: a locked `mk` opens the explainer.
- `server/server.js` (WS-I): the `GET /api/invite/:code` block, to move into WS-I's route split.

The handlers in `68-welcome.js` and `71-onboarding.js` collect in `ACT_B`, and `97-help.js` merges them into `ACT`, because `ACT` is declared after them in build order.

## Tests

| Suite | File | What |
|---|---|---|
| pbt | `test/pbt/unlock.test.js` | P20 over 1,000 random month-long walks: nothing re-locks, nothing opens before its rule held, nothing lags. Unlocks are monotone in each input. C25's table at its edges. Every lock has a reason. + menu ≤ 6 rows on day 1. C17 age: boundary-exact, monotone in time, IN 18 / else 16, junk is "not answered" |
| unit | `test/unit/firstrun.test.js` | `suggestDomain`, `emailOK`, every lane example parses, ₹ not £, the chip, glossary covers the 17 nouns, `helpMarks`, copy lint (no "your five") |
| e2e:flows | `test/e2e/flows/firstrun-local.test.js` | F01 local on Pixel 7 and iPhone 13 side by side: welcome, intro (full / skipped), DOB gate incl. under-18, Shuffle and preview, reload mid-onboarding, examples and chip, tour (persisted), + menu, locked Midnight, ? and Help, tour replay, visit 2 without intro, skip and solo Ledger |
| e2e:flows | `test/e2e/flows/firstrun-server.test.js` | F03 server: returning device straight to sign-in, OTP attributes, sign-in reload on the code step, pasted code autosubmits, age attestation stored, `/api/invite` contract + 404 + 429, invite preview before sign-in, one primary, typo fix, inline error, resend countdown on a fake clock, Fill dev code, Join-first circle step, no soft-ask in onboarding, soft-ask after the first plan, Not now remembered, first plan unlocks favor and pot |
| regression | `test/regression/firstrun.test.js` | R-C11, R-C16, R-C17, R-C57 |
| golden | `test/golden/firstrun.test.js` | 11 screens × Pixel 7 / iPhone 13 × light / dark (44 DOM + 44 pixel goldens under `ws-b/`), each audited for WCAG AA text contrast on WS-B's screens and pieces, 44 px WS-B tap targets, and no sideways scroll. Contrast problems elsewhere print with `VERBOSE=1` as notes for WS-H |

Changes to existing tests:
- **The diff registry check** now allows the actions and sheets each workstream declares in `test/diff/changes/<ws>.json`. WS-B declares 20 actions, 2 sheets and 1 changed sheet (`make`).
- **The legacy e2e ports** keep every check. The changes are:
  - month + year instead of the age checkbox;
  - a tap on the invite preview;
  - no Sign in tap after typing the code, because it submits itself;
  - each run starts with the intro and tour seen and everything unlocked.
- **`screens.test.js`** follows WS-A's v0.9-golden form and starts past the intro and tour.
