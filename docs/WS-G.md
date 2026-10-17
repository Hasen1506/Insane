# WS-G: Ledger and India money (v0.9)

Critiques closed: **C52** (UPI), **C53** (₹ grouping), **C54** (balance explainer and sign). C55 (the stamp over the buttons) is WS-H's (`celebrate()` lives in `79-activity.js`); C56 (solo Ledger) is WS-B's `soloLedger()`.

## What changed

- **UPI for INR pots (C52).** The new-pot form asks INR organisers for a **UPI ID** (validated `handle@bank`) instead of the `paypal.me/you` field; "How to pay you" on a thread pot does the same. A pledger who owes gets **Pay ₹1,500 by UPI**, a plain `<a href="upi://pay?pa=…&pn=…&am=1500.00&cu=INR&tn=…">` (amount always 2 dp, every value percent-encoded, `@` kept literal), plus the UPI ID with copy, and a QR of the same URI on fine-pointer screens (`qrSvg()`, which WS-A swaps to its vendored encoder). Pay methods for INR are UPI, bank transfer, cash. INSANE still never holds money and only the organiser confirms.
- **Money in paise, shown in lakhs (C53).** `toP()` reads what people type (`1,50,000`, `₹1500.50`); `money(paise, cur)` formats with `Intl.NumberFormat` (`en-IN` for ₹: `₹1,50,000`, `.00` dropped for whole amounts). `potSum()` adds a pot up in integer paise: paid + due = total = per × pledged.
- **Ledger reads first (C54).** Balance coloured *and* signed in words ("The circle owes you 2 h of help." / "You owe the circle 2 h of help." / "All square."), limit on the same line, the rest folded under "How favors work". Circle rows say *owed/owes*. Pots open with a **Who owes what** card (what you still pay, what's still owed to you, per pot, totals per currency); a pot card says "you owe ₹1,500" or "₹1,500 still to come in".
- **Rules enforced in the client too** (the server already refused these; the PBT found the client accepting them): no logging, claiming or confirming your own favor; only the asker takes down an unlogged favor (v0.8 let anyone delete any favor, logged ones included); only the organiser confirms a payment, only for someone who's in; you mark only your own share.
- **Server, one hunk** (`server.js` threads update): only the organiser can change a pot's `upi`/`pay` (anyone in the circle could repoint where the money goes), and `upi` must match the VPA pattern. WS-I: port this to `server/rules/circles-threads.js`.

## Tests

| Suite | File | What |
|---|---|---|
| pbt | `test/pbt/ledger.test.js` | P01–P05 on the real ACT handlers + LocalDB with random actors (1,000 sequences each): balance ≥ −5 h, never for yourself, hours conserved; only the organiser confirms, own share only, paise conserved. ₹ = Intl en-IN; format→parse round-trips (5,000); UPI URI params exact and escaped (3,000); VPA regex |
| diff | `test/diff/ledger.test.js` | potState/potOn/nIn/potPaidN and balance identical to v0.8 on v0.9-shaped data; the same random favor+pot op sequences on v0.8 and v0.9 give the same balances and pot states after every op, except the refusals listed in `test/diff/changes/ws-g.json` (each must be hit) |
| e2e:ledger | `test/e2e/ledger.js` (+ `ledger-flow.js`) | Pixel 7, local mode: INR pot with UPI, bad UPI refused, ₹1,500 and ₹1,50,000, Pay by UPI href asserted and the tap opens it, organiser-only confirm (forced act refused), favor balances |
| golden | `test/golden/ledger.test.js` | 4 ledger screens × light/dark, DOM + pixels, `test/golden/*/ws-g/` |

`tab-ledger` in the ws0 goldens is re-baselined and listed in `ws-g.json` "screens"; `screens.test.js` reads that list from every `test/diff/changes/*.json`. `pure.test.js` takes WS-B's `changes/*.json` hunk verbatim so the two merge cleanly.

## Left for others

- Home (`72-home.js`), Circle (`73-circle.js`) and the pledge toast (`90-actions/circle.js`) still print `potCur(p)+p.per` (e.g. `₹1500`). Swap to `amt(p)`: WS-C.
- Plan pots (`plans.js`) and thread pots (`circle.js` `t-create`) still round to whole units; their organiser adds UPI through "How to pay you".
- No "total, split N ways" pots (paise remainder split): left out for the size budget (+6 KB here).
