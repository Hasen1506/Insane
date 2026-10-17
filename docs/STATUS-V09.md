# v0.9 status: all 108 critiques

Built at int-2 from the workstream docs (WS0, WS-A, B, D, E, G, I), the WS-C, WS-F and WS-H commit messages (they have no doc), INT-1 and INT-2, and a read of the code. “Closed” means the fix in [CRITIQUES-V09](CRITIQUES-V09.md) is in v0.9 and a test covers it; “partial” means some of the fix is in and the rest is named; “needs Vijay” means the code side is done and what is left is a decision, an account or a key only Vijay can give.

| Status | Count |
|---|---|
| closed | 93 |
| partial | 12 |
| open | 1 |
| needs Vijay | 2 |

Workstreams: A phone shell/PWA, B first run, C Home/Circle/invite, D safety, E content, F map, G ledger, H visual/a11y/i18n, I server/ops, J tests, 0 the split, int-1/int-2 the integrations.

| # | P | Critique | Status | WS | Notes |
|---|---|---|---|---|---|
| C01 | P0 | No `<meta name=viewport>` | **closed** | A | WS-A.md |
| C02 | P0 | Not installable; iOS push impossible | **closed** | A | WS-A.md |
| C03 | P1 | No `<!doctype html>` and no `<html lang>` | **closed** | A | WS-A.md |
| C04 | P1 | The QR library loads from cdnjs at runtime | **closed** | A | WS-A.md |
| C05 | P1 | Back button exits the app | **closed** | A | WS-A.md |
| C06 | P1 | Fresh scroll position isn't reset after onboarding | **closed** | A | WS-A.md |
| C07 | P2 | There is no offline banner, and no offline shell | **partial** | A | offline banner, SW shell and cold-offline shell done; the write queue with idempotency keys is not built (the banner says changes won’t send) |
| C08 | P2 | PWA update flow is undefined | **partial** | A, I | versioned SW and update bar done; the client never reads `x-insane-min-build`, so there is no forced upgrade below a minimum build |
| C09 | P1 | The first screen is a bare email box with no value proposition | **closed** | B | WS-B.md |
| C10 | P1 | No intro walkthrough | **closed** | B | WS-B.md |
| C11 | P1 | The invite deep link loses context at sign-in | **closed** | B | WS-B.md |
| C12 | P2 | Bad email gets only the browser's native bubble | **closed** | B | WS-B.md |
| C13 | P2 | The code entry field isn't optimised for OTP | **closed** | B | WS-B.md |
| C14 | P1 | Email-code is the only sign-in | **partial** | B, I | server `POST /api/auth/google` done and tested with a mocked tokeninfo; there is no Google button in the page yet, and it needs Vijay’s OAuth client ID. Phone OTP not started (needs a DLT-registered SMS sender) |
| C15 | P3 | The "Development server: codes are printed in the server log" line also shows on phones in dev | **closed** | B | WS-B.md |
| C16 | P1 | Onboarding progress is lost on reload | **closed** | B | WS-B.md |
| C17 | P1 | The age gate is a 13 px checkbox with a 16+ rule | **closed** | B, D | month/year DOB, 18+ IN / 16+ elsewhere; server requires adult + consent |
| C18 | P2 | Step 1 copy contradicts the product: "With your five", while circles go up to 8 | **closed** | B | WS-B.md |
| C19 | P2 | The "Your handle" concept is unexplained and random (LATE CAB, NIGHT BUS…) | **closed** | B | WS-B.md |
| C20 | P1 | Long names are silently cut, mid-word | **closed** | C | server/text.js clip() and the page’s clip(): word boundary, never mid-grapheme (people 40, circles 28, Midnight 400) |
| C21 | P1 | RTL and mixed-script names aren't isolated | **closed** | H, int-2 | nameOf()/bidi() isolate RTL names; int-2 put WS-C’s Home/Circle/switcher names and City/drops/safety names through bidi(); dir=auto on fields |
| C22 | P2 | The circle step on an invite link still leads with "Start a circle" | **closed** | B | WS-B.md |
| C23 | P2 | "Look around first" (skip) gives no idea of what's lost | **closed** | B | WS-B.md |
| C24 | P2 | The "What's on your mind" step has no examples per lane, and the "how INSANE reads it" line is in 11 px mono | **closed** | B | WS-B.md |
| C25 | P1 | Gradual unlock was designed and never built | **closed** | B, I | client unlock table (96-unlock.js); `/api/unlocks` exists on the server but the client computes its own set (same table) |
| C26 | P1 | No first-run tab tour | **closed** | B | WS-B.md |
| C27 | P1 | Solo Home has no persistent invite card, and the code is shown only in a toast | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C28 | P1 | No `navigator.share` and no WhatsApp invite | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C29 | P2 | "1 thing today" sits above "Nothing on the go" | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C30 | P1 | Home priority order buries what needs action | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C31 | P2 | The footnote "One list. Whatever needs you today…" is hidden behind the tab bar | **closed** | A | WS-A.md |
| C32 | P2 | Empty "No drops within 5 km yet" uses a dashed border and mono text that looks disabled, but it's a CTA for shops | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C33 | P2 | The Decode card's puzzle text is the largest, heaviest type on Home | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C34 | P2 | There's a red dot on City for a brand-new solo user who has nothing new | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C35 | P1 | No circle admin | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C36 | P1 | One circle per person | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C37 | P0 | Midnight's "names are blocked" rule is client-only and misses first names | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C38 | P2 | The Chat composer floats mid-screen with a big gap, and there are no message states | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C39 | P2 | Plan cards don't show time in a scannable way, and you can't add the plan to a calendar | **open** | C | no date chip, no “Add to calendar” (.ics) and no map link on plan cards |
| C40 | P2 | Pacts: the 20 tiny squares under a 3-a-week pact are unexplained | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C41 | P2 | Mole and Midnight "needs N" exists only inside each segment; the segments themselves don't show a lock | **closed** | B | segLockTag “3+”/“4+” on locked Circle segments, lock cards |
| C42 | P3 | The circle avatar row: a self-avatar letter mismatch ("Y" for You in "What everyone's on" vs "A" in the header), and the "+" add-person circle is 36 px | **closed** | H | one 44 px avatar component |
| C43 | P1 | On mobile the City map is below the fold | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C44 | P1 | The City map shows circle members by name at their square centre ("Ravi") | **closed** | C, D, F | server reads `cell` only when `people.showSquare` is on; You › Safety toggle, off by default; opted-in squares on the City map |
| C45 | P2 | Calls: "Posted." toast, but the list still says "No open calls in Chennai" | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C46 | P2 | Feed actions "Hide" and "Report" are 12 px text links. Reactions are 28 px pills. "Delete" on your own post is a bare word | **partial** | H, D | links and reactions are 44 px; the ⋯ overflow menu (Report / Hide / Block circle) on feed posts was not built |
| C47 | P2 | League: an empty table with a dense paragraph of rules | **closed** | C | WS-C commits (homeItems(), invite card + share, multi-circle switcher, chat states, pact week, calls, league); tests in test/pbt/circle.test.js, test/regression/circle.test.js, e2e flow c-circles |
| C48 | P0 | The Decode answers ship in the page | **closed** | E | WS-E.md |
| C49 | P2 | When tiles fail, the map is blank, with no fallback | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C50 | P2 | Drop draws are predictable before they run | **closed** | E | WS-E.md |
| C51 | P2 | Missions and trails forms are long single scrolls with a third copy of the place picker | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C52 | P1 | Pots in India default to "paypal.me/you", with no UPI | **closed** | G | WS-G.md; WS-C swapped Home/Circle to amt(). Plan and thread pots still round to whole rupees |
| C53 | P2 | Pot amounts render as "₹1500", not "₹1,500" | **closed** | G | WS-G.md; WS-C swapped Home/Circle to amt(). Plan and thread pots still round to whole rupees |
| C54 | P2 | The favor balance explainer is 4 lines of 11 px mono | **closed** | G | WS-G.md; WS-C swapped Home/Circle to amt(). Plan and thread pots still round to whole rupees |
| C55 | P2 | The "LOGGED" stamp animation overlays the action buttons | **closed** | H | stamp drawn at the tap, pointer-events none |
| C56 | P2 | Solo Ledger is a dead end | **closed** | B | WS-B.md |
| C57 | P1 | 15 flat text rows, with no grouping, icons or lock state | **closed** | B | WS-B.md |
| C58 | P1 | Notification permission is buried in Profile | **closed** | B | WS-B.md |
| C59 | P1 | Delete account keeps you signed in and drops you straight back into onboarding | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C60 | P2 | No change-email, no list of signed-in devices, no "sign out everywhere" | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C61 | P2 | Go dark relies on the phone clock; a 14-day server clock jump still showed "59:55" | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C62 | P2 | Export downloads JSON only | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C63 | P1 | No Terms, Privacy Policy, community rules or grievance contact | **needs Vijay** | D | Terms, Privacy and Rules drafts served at /legal/*; legal entity, grievance officer name/email, processors, retention and jurisdiction are marked “needs Vijay”; no legal review yet |
| C64 | P1 | The place picker opens on Africa (Kinshasa, Nairobi) for a user in Chennai | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C65 | P1 | Three ways to set a place (search, GPS, paste link) plus tap-the-map, with no hierarchy | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C66 | P1 | There's no live preview of what others see that is honest about the Exact mode | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C67 | P2 | Search results are noisy | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C68 | P2 | Map controls are 36 px, there is no visible pinch hint, labels clip at edges ("onneri", "Chi…"), and the legend is 10 px mono | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C69 | P1 | Tile provider: tile.openstreetmap.org forbids heavy or commercial-scale app use | **needs Vijay** | F, I | PMTiles/XYZ engine and `TILE_URL`/`TILE_FILE` config done; production needs a tile source chosen and paid/hosted (a basemap.pmtiles extract on the disk, or a provider key). Default is still tile.openstreetmap.org |
| C70 | P2 | Secondary text is mono at 10–11 px everywhere (explainers, rules, legends, timestamps) | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C71 | P2 | Primary CTAs aren't distinguished | **partial** | H | filled primary / outline secondary exists, but there is no one-primary-per-screen rule or test, and primary is ink, not the stamp red the fix asked for |
| C72 | P2 | Cards don't separate from the background | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C73 | P1 | Toasts are big pills that overlap content and persist across screens | **closed** | C, H, int-2 | one #toasts region (role=status, aria-live), one at a time, 3.2 s, above the tab bar, pointer-events none, cleared on any screen change; a toast set by the tap that moved you stays |
| C74 | P3 | The header's top-right block is 4 pieces of 10 px mono (dot, circle name, city, square size) next to a 32 px avatar | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C75 | P3 | Dark mode is mostly good | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C76 | P1 | Tap targets under 44 px are pervasive | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C77 | P2 | Icon-only controls have weak names | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C78 | P2 | No visible focus ring, and sheets don't trap focus | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C79 | P2 | No automated a11y checks | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C80 | P3 | Reduced motion is respected only for `.pulse`. The draw spinner, LOGGED stamp, confetti and breathing circle animate regardless | **closed** | H | tokens.css, a11y suite (test/a11y: 56 screens light + dark, 0 findings), raw-colour lint |
| C81 | P1 | `places.tsv` (2.7 MB raw, 1.35 MB gzipped) is downloaded again on every page load and every picker open | **closed** | F | WS-F commits: map-first City, tile fallback, wizards, tz first view, one picker with You see / Others see, grouped search, 44 px map controls, per-country place chunks (no WS-F.md) |
| C82 | P2 | `index.html` is 275 KB (86 KB gzipped) of inline JS and CSS, parsed on every load | **partial** | H, int-1 | perf test (4× CPU, render-complete budget) passes, but the page is 408 KB raw / 137 KB gzip, up from 275 / 86; segments are not lazily rendered |
| C83 | P1 | No data migration story from v0.8 to v0.9 stores | **partial** | I | server schema migrations (steps 0–4, v0.8 fixture DB test) done; the artifact-mode client migration with export-first backup is not built |
| C84 | P1 | Rate limits exist only on geo search and OTP | **partial** | I | per-uid/IP token buckets per route class, MAX_BODY, Retry-After done; push coalescing not done |
| C85 | P2 | Session cookie and headers need a production review | **closed** | I | server/headers.js on every response, cookie flags, tested (no CSP meta in artifact mode, by design) |
| C86 | P2 | The claude.ai artifact mode hides secrets "only by the page" (Decode, unopened Midnight, Mission spots) | **closed** | E | WS-E.md |
| C87 | P0 | No block or report for a person | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C88 | P1 | No "this dare isn't safe" flag on the daily dare, jar dares or dares sent to you | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C89 | P1 | No owner moderation view | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C90 | P2 | The "Here now" presence plus a square on the map plus a public handle could identify people | **closed** | D | WS-D.md (C87: per-person block/report; a per-message report path is not in the UI) |
| C91 | P1 | Only 8 Decode puzzles, London-flavoured (Waterloo, Big Ben), served to Chennai | **closed** | E | WS-E.md |
| C92 | P2 | 8 starter dares and 8 Mole tasks, so they repeat within 2 weeks | **closed** | E | WS-E.md |
| C93 | P2 | No owner content tool | **closed** | E | WS-E.md |
| C94 | P3 | Unbuilt v0.6 items: Zones/fixtures, Chapters, vouch and Reliability, 15 s video clips | **closed** | — | out of v0.9 scope by decision (PLAN-V09 §6); nothing built |
| C95 | P2 | English only | **partial** | H | 95-strings.js with t() and English fallback; only the activity feed and its notices use it. Most copy is still inline; no Tamil/Hindi (planned for v1.0) |
| C96 | P0 | No deploy config | **closed** | I | Dockerfile, render.yaml, backups, RUNBOOK.md, no ExperimentalWarning. Hourly WAL shipping not built (snapshots only; BACKUP_EVERY_H=1 for hourly) |
| C97 | P0 | SQLite has no backup | **closed** | I | Dockerfile, render.yaml, backups, RUNBOOK.md, no ExperimentalWarning. Hourly WAL shipping not built (snapshots only; BACKUP_EVERY_H=1 for hourly) |
| C98 | P1 | No error monitoring | **partial** | I | server Sentry + `/api/err` tunnel done; the page never posts window.onerror to `/api/err`; needs a SENTRY_DSN from Vijay to be on |
| C99 | P1 | No rollback or release process | **closed** | I | Dockerfile, render.yaml, backups, RUNBOOK.md, no ExperimentalWarning. Hourly WAL shipping not built (snapshots only; BACKUP_EVERY_H=1 for hourly) |
| C100 | P2 | The `node:sqlite` ExperimentalWarning prints on every start | **closed** | I | Dockerfile, render.yaml, backups, RUNBOOK.md, no ExperimentalWarning. Hourly WAL shipping not built (snapshots only; BACKUP_EVERY_H=1 for hourly) |
| C101 | P2 | No analytics funnel | **partial** | I | server funnel (allowlisted steps, once per person per day, owner report) counts email/code/name/circle from real requests; the page posts no steps itself, so `welcome` is never counted in production, and the owner Stats view still reads v0.8’s ev/ docs |
| C102 | P2 | Timezones: Midnight and quiet hours use the device's local time. The Mole reveal is "Sunday 21:00" per circle, but the circle may span zones | **partial** | I, D | server: Midnight at 00:00 circle time, quiet hours and the Mole reveal in the person/circle tz; the page doesn’t yet say “00:00 Chennai time”, and the client still shows device-local times |
| C103 | P1 | Tests hardcode `/opt/pw-browsers/chromium` and `/opt/node22/lib/node_modules/playwright` | **closed** | 0, J | WS0.md, INT-1: no hard-coded paths, no fixed sleeps, PBT/diff/golden suites |
| C104 | P1 | Tests use fixed sleeps (151 `wait(…)` calls), including two `wait(21000)`, and a 400 px desktop viewport | **closed** | 0, J | WS0.md, INT-1: no hard-coded paths, no fixed sleeps, PBT/diff/golden suites |
| C105 | P1 | No property-based tests, differential tests or golden screenshots | **closed** | 0, J | WS0.md, INT-1: no hard-coded paths, no fixed sleeps, PBT/diff/golden suites |
| C106 | P2 | The test fixtures are all ASCII, short-name, Western cities, plus Tokyo and Lagos | **closed** | J, C, D | fixtures with Tamil, Arabic, emoji, 40-character names and ₹ pots in pbt/regression/flows |
| C107 | P2 | On the server version the build-notes rail shows claude.ai copy | **closed** | A | WS-A.md |
| C108 | P1 | No help or glossary for about 15 invented nouns | **closed** | B | WS-B.md |
