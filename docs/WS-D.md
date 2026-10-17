# WS-D: safety, moderation, legal, account (v0.9)

Branch `ws-d`, based on `v0.9` at `888f1fd`. Closes C35, C37, C59, C60, C61, C62, C63, C87, C88, C89, C90 and the server side of C17 and C44.

## Server

New files. `server.js` only gained hook calls, plus an export for in-process tests.

| File | What |
|---|---|
| `server/names.js` | The Midnight name screen and the dare keyword screen (pure functions). `src/js/98-safety.js` carries a copy between `// <names>` markers. `test/unit/safety.test.js` fails if the two copies differ. |
| `server/moderation.js` | `canRead`/`canWrite`/`beforeWrite`/`readFilter` hooks and the routes `block`, `report`, `admin/queue\|act\|audit`, `circle/rename\|remove\|unremove\|transfer\|close\|code`. Tables: `reports` and `audit`. |
| `server/account.js` | Routes `account/delete\|sessions\|revoke\|email/start\|email/verify\|consent\|export`. Adds `created`, `seen` and `ua` columns to `sessions`. |

### Rules

- **Circles.** Only members can read or write `circles/{cid}/**`. Membership follows `people/{uid}.circle`, and the server keeps `circles/{cid}.members` in step. Joining is refused if you were removed, if the circle has closed, or if it already has 8 people.
  - A non-member gets an invite preview of the circle doc: name, city and count.
  - A removed person gets `null`.
  - Only the owner (`owner`, falling back to `by`) can rename, remove (with a 24 h undo), transfer, rotate the code or close.
  - A raw doc update can't change `owner`, `removed`, `code` or other people's membership.
- **Midnight (C37).** On write, the server refuses any token of 2+ letters from another member's name, after NFKD, case-fold, accent and zero-width stripping and Cyrillic/Greek look-alike folding. Scripts without spaces (CJK, Thai, Arabic, Hebrew) are matched as substrings. The refusal is `failed_precondition` with `reason: names_blocked`.
  - On release, the text is checked again against anyone who joined after it was written. The doc's `m` field (everyone in the circle at write time) is how the server knows who joined later.
  - The stored doc's keys are only `text`, `releaseAt`, `flags`, `m`, `reacts`, `removed` and `removedAt`, so the author is never stored.
  - **Judgment call on handles.** A one-word handle is matched whole and by its letter-runs. A multi-word handle ("LOW TIDE") is matched as the phrase only, because its words alone are everyday words.
- **Blocks (C87, P12).** `data/users/{uid}/blocks` is written through `POST /api/block`. A block works both ways.
  - Neither person sees the other's posts, calls, messages (threads, rooms, DMs), dares, clips, cheers, missions, trails, drops or presence.
  - Neither can DM, dare, cheer or react to the other, and no notifications pass between them.
- **Reports.** `POST /api/report` takes `{kind, uid|path, category, note, block?}` and is limited to 20 a day per person.
- **Dares (C88).** A keyword screen covers traffic, fire, heights, alcohol and drugs, the law, money, strangers' bodies and harm. The refusal has `reason: unsafe_dare`.
  - One ⚑ hides a dare for the person who flagged it. Two pull it from the jar for the whole circle and log it to the audit table.
  - Flagging the daily dare moves the day's pick on.
- **Owner queue (C89).** `admin/*` is for `OWNER_EMAIL` only (anyone else gets 403). It shows open reports, flagged posts, flagged and pulled dares, Midnight removals (and messages with 2+ flags), and recent Missions with their verdicts. Every action is written to `audit`.
- **Presence and squares (C90, C44).** `live/{uid}` is visible only to the same circle and can be turned off (`people.presenceOff`). Other people's `people` docs lose `cell` unless you share their circle, and never include consent records.
- **Sign-up (C17 server, C63).** `people/{uid}` is created only with `adult: true` and `consent.v` equal to the current version (`2026-10-draft`). The server stamps `adultAt` and `consent.at`, and the page can't rewrite either.
- **Delete (C59).** One transaction:
  - It deletes everything whose path holds the uid, plus their own posts, calls, clips, dares, sealed messages, cheers, drops, Missions and trails.
  - Everything else is scrubbed: map keys and list entries go, and remaining references are re-signed `former`. Messages show "Former member".
  - Circles they owned pass to the next member, or close if nobody is left.
  - Sessions, push subscriptions, OTPs, the account row and Mole claims go. Reports and audit entries are anonymised.
  - Then the cookie is cleared, the live streams end and an erasure email is sent. DMs with the deleted person are deleted for both sides.
- **Sessions (C60).** You can list sessions (device, last used, signed in), revoke one, or revoke all or all others. Revoking ends that session's SSE streams.
  - Change email: a code goes to the new address, the old address gets a notice, and an address that already has an account is refused.
- **Export (C62).** `account/export` returns the JSON plus a readable HTML page: profile, consent, messages you wrote, the favor ledger, pots, posts and journeys.

## Client (`src/js/98-safety.js`, plus small hooks)

- **Circle.** Tap a member to open the Block / Report sheet. The owner also gets Remove and Make owner, and a Settings sheet: rename, new code, removed list with Undo, and close by typing the name.
- **You.** An Account card (email change, devices, sign out everywhere) and a Safety card (presence toggle, blocked list, legal links, grievance placeholder, and Moderation for the owner).
- **Onboarding.** An explicit consent checkbox linking the Terms, Privacy notice and Rules. Next says what's missing.
- **Delete (server).** One call, then a reload to the sign-in screen with "Your account is deleted". Demo mode keeps the client-side delete.
- **Dares.** Scale relabelled "How bold, 1 to 6". ⚑ Not safe on jar dares, the daily dare and dares sent to you.
- **C61.** In server mode, `now()` follows the server's clock when the phone is more than 5 s off. It resyncs every minute, and the same poll notices a revoked session.
- **Legal.** `app/legal/{terms,privacy,rules}.html`, served at `/legal/*`. Marked "Draft, not legal advice". Placeholders are marked **needs Vijay**: legal entity, grievance officer name and email, processors, backup retention, jurisdiction city.

## Tests

| Suite | What |
|---|---|
| `test/pbt/safety.test.js` | About 6,400 seeded cases against the real rules in process (`test/lib/inproc.js`, in-memory DB): P07 (write, handle, author never stored, release), page and server agree, P12, C35 (owner only), C35 (removed stays out), P25 |
| `test/regression/safety.test.js` | R-C37, R-C59, consent on sign-up |
| `test/unit/safety.test.js` | The shared name-screen code is identical in both copies; the legal pages; the consent version; the dare screen; C61 clock skew |
| `test/e2e/flows/d-safety.flow.js` | F15–F17 on Pixel 7, server mode, 48 checks. Run with `node test/e2e/flows/run.js` (suite `e2e:flows`) |
| `test/diff/allowed.json` | Documented additions and changes since v0.8 (actions, sheets, the dare sheet, golden screens), read by `diff` and `golden` |

## Left for others or later

- **C44 opt-in, left to WS-F.** Circle-mates still get each other's square, and the map dot is WS-F's to remove. "Show me to my circle" isn't built.
- **C17 DOB UI is WS-B's.** The server only requires `adult: true` plus consent.
- **Demo / claude.ai mode doesn't enforce blocks.** There's no server there; blocks are stored and the person sheet works.
- **Message-level report.** Tapping a message author opens the person report; there's no per-message path in the UI yet.
- **Legal review and the needs-Vijay fields.**
