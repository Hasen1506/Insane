# INT-2: v0.9 integration, round 2

Branch `int-2`, from `v0.9` at cdc2e93 (int-1: A, B, D, E, F, G, I). Merged **ws-h** (636d20a), then **ws-c** (6295af4: 3936649 plus its uncommitted PBT/regression tests, the Decode teaser fix and the e2e edits, committed in wt-c without its regenerated goldens). ws-h's uncommitted goldens were discarded. Every golden was regenerated here, after the merge. Critique status for all 108: [STATUS-V09.md](STATUS-V09.md).

## Merge decisions

ws-h merged cleanly. ws-c conflicted in `70-shell.js`, `74-city.js`, `79-activity.js`, `base.css` and `components.css` (`screens.css` merged on its own).

| Where | WS-H | WS-C | Decision |
|---|---|---|---|
| Toasts (C73), `79-activity.js` | one snackbar, 3 s, cleared on any screen change (tab, segment, open thread, sheet) with a 600 ms grace so a toast set by the tap that moved you stays; `role=status` on the toast | one `#toasts` region outside the redrawn screen (`aria-live`), one at a time, 3.2 s, cleared on a tab change, `pointer-events:none`, extra bottom room | **One region, union of the rules.** `#toasts` (`role=status`, `aria-live=polite`) in `body.html`; `toast()` paints it at once; one message at a time; **3.2 s**; above the tab bar; never takes a tap; cleared on any screen change (WS-H's `screenKey`). The 600 ms window is gone: the screen a toast belongs to is the one it is first *drawn* on, and a tap's changes always land before the next draw, so "a toast set by the tap that moved you stays" holds without a timer and without fake-clock trouble. WS-C's PBT and R-C73 now model the draw between taps (`toast(m);toastHtml()`); WS-H's R-C73 reads the role from the region and no longer pokes `toastAt`. |
| Toast CSS | ink pill, 2-line clamp, shadow, 16 px above the bottom, above the nav when there is one | full-width bar above the nav, `pointer-events:none`, `#app` padding while one shows | WS-H's look and placement + WS-C's `pointer-events:none` and padding rule; tokens only. |
| Header (C74 vs C36) | the circle name only | a button (to the switcher) with name, city and square | **A button with the circle name only** (`.where`, 44 px, `bidi()`), opening the circles sheet. City and square are on You (C74). |
| `.where`, `.av`, `.msg`, `.compose`, `.sheet h2`, `.darkall` | tokens, 44 px avatar, `--sab`, 900-weight sheet titles, night tokens | button reset, keyboard-aware composer, message states | Both: WS-H's sizes and tokens; WS-C's button reset, `.chat` height, message states and composer `z-index`. WS-C's raw `#ECEEE7` in `.darkall .clock` went with WS-H's `var(--mn-ink)`. The raw-colour lint passes. |
| Calls (`74-city.js`) | `bidi()` on the answerer | `callCard()`, "Your circle's calls" (C45) | WS-C's structure, with `bidi()` on the answerer and the circle name. |
| Names (C21) | `nameOf()`/`bidi()` outside Home/Circle | direct `esc(m.name)` in Home, Circle, switcher | Every name and circle name in 72-home, 73-circle, the switcher, and (found while checking) City feed/calls/league/missions/trails, drops and the safety sheets goes through `bidi()`. Input values are left alone, since an isolate in a field would be typed into the name. |

Other changes in this round:

- **Router (C05), a real race.** The goldens' `openSheet('invite')` straight after Escape closed the + sheet timed out about one run in two. Escape → `history.back()` → popstate (handled) → *a separate task* → hashchange; the hashchange compared `#/you` with a `S.ui` that now had the invite sheet, took it for a followed link and closed the sheet. The hashchange of a traversal popstate already handled is now skipped by URL (`ROUTE.popped`). New check in `regression/shell.test.js` opens a sheet inside the popstate: the old router fails it on Pixel 7 and iPhone 13, the new one passes.
- **The onboarding read chip** (`.obchip .chip`, a label) lost WS-H's 44 px minimum: as a flex item it became a 44 px pill with "Pact" at its top. It is not a tap target.
- **a11y over WS-C's screens.** `test/a11y/screens.test.js` now also audits the Home invite card (fewer than 3 people), the circle switcher with two circles, and the invite sheet with the share row, and fails if the card or the two rows aren't drawn: 56 screens per scheme, 0 findings (contrast, targets, names, fonts, cards, bidi, animations, sideways scroll).
- **Flaky funnel check fixed** (`unit/server-http.test.js`). It looked for `u_` anywhere in the funnel tables, and a random hex hash in `funnel_seen.h` can contain it. It now reads every uid and email from `users`, adds the two signed-in uids and the anon browser id, and fails if any funnel cell contains one of them (or an `@`).
- **The 2–7% pixel drift WS-C saw on welcome and onboarding was not the code.** On this box ws-c's own build (6295af4) against cdc2e93's goldens: welcome, intro, age gate and the step-4 chip are within tolerance on Pixel 7 and iPhone 13, light and dark; only the four screens with the header (home tour, + sheet, Help, locked Midnight) differ, which is WS-C's header button. Neither suspect moves a pixel: no welcome/onboarding screenshot has a `.chip`/`.tag` that the ellipsis rule touches, and `interactive-widget=resizes-content` only matters with an on-screen keyboard, which headless Chromium doesn't show (switching it at runtime: 0 pixels changed; removing `#toasts`: 0). The likely cause is the box: this box lost `fonts-noto-color-emoji` once mid-round (the welcome bullets and intro cards are emoji), and the goldens here were made only after reinstalling it and checking `fc-list`.
- **Goldens regenerated** from the minified build, all 88 images looked at (Pixel 7 and iPhone 13, light and dark; ws0, ws-b, ws-f, ws-g). Every change against cdc2e93 is WS-H's tokens and system fonts, the header, WS-C's Home and invite card, or the chip fix above. Nothing clipped or overlapping. The ob-1-ok shots start scrolled (the tap on Next scrolls it into view), as before.

## Bundle

Budget 400 KiB = 409,600 B, not raised. The straight merge built to **410,350 B** (over).

| Saving | Bytes |
|---|---|
| Build markers `/* src/js/70-shell.js */` → `/*70-shell*/` (66 files; `build.test.js` checks one per file, in order) | 792 |
| Indentation after a newline inside template literals (esbuild's one-line output has raw newlines only there, and all of them are HTML between tags; `diff` compares that one difference away for the built side only) | ~790 |
| One `CANCEL` for the 13 identical sheet Cancel buttons | ~640 |

| Build | Raw | gzip -9n |
|---|---|---|
| shipped, minified (`app/index.html`) | **408,326 B** (99.7% of budget, 1,274 B left) | **135,632 B** |
| `MINIFY=0` | 470,442 B | 156,353 B |
| int-1 (cdc2e93), for comparison | 403,814 B | 131,518 B |

The next feature that adds copy will not fit. The real fix is C95 finished (strings out of templates) or lazy screens (C82).

## Suite results

The full `npm test`, every suite serially in `test/run.js` order, twice in a row at RUNS_SHA (the commit before this doc). Times in seconds, on a shared 2-core box.

RUNS_TABLE

Budgets are informational (`BUDGETS=strict` not set).

## Known gaps

- Partial or open critiques are listed in STATUS-V09.md: C07, C08, C14, C39, C46, C71, C82, C83, C84, C95, C98, C101, C102, plus C63 and C69 waiting on Vijay.
- Bundle headroom is 1.3 KB.
- `ccr-25f42e9d-g2mmei` untouched.
