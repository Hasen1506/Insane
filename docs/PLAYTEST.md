# Playtest: two weeks, eleven people, four cities

Run 2026-10-17T06:59 UTC against the INSANE server (real email sign-in, real GPS per person, OpenStreetMap search and tiles). Simulated days start Monday 2026-10-19.

**92/92 checks passed.**

## Screens

- [What’s on your mind](playtest/p01-alice-4-mind.jpg)
- [Home](playtest/p02-alice-today.jpg)
- [Ledger: favors](playtest/p06b-ledger.jpg)
- [Pots](playtest/p06c-pot.jpg)
- [A Mission](playtest/p10b-mission.jpg)
- [A trail](playtest/p12b-trail.jpg)
- [The Mole](playtest/p16b-mole.jpg)
- [City map, server version (OpenStreetMap)](playtest/p09-city-map.jpg)
- [City map inside claude.ai (bundled map)](playtest/c1-claude-ai-map.jpg)

More in [`playtest/`](playtest/). How this test differs from the simulator, and what it changed in the app: [`V08.md`](V08.md).

## Diary

- **D0 Mon 09:00 UTC · Alice.** Signed in with an emailed code, picked a handle, used GPS (exact pin, kept private), started Third Floor, then typed “run 3 times a week”: it became a pact with “I cook for the circle” as the stake. 5.1 s, 13 taps after sign-in.
- **D0 Mon 09:00 UTC · Bob.** Searched "Lisbon", kept a 1 km² zone only, joined Third Floor with Alice's code. Sign-in 0.6 s; onboarding 2.4 s.
- **D0 Mon 09:00 UTC · Carol.** GPS, then a 9 km² zone (the biggest). Started Night Shift.
- **D0 Mon 09:00 UTC · Erin.** Scanned Carol’s invite QR, which opened INSANE with the code filled in. GPS in Amadora, 8 km out; set drops to 10 km.
- **D0 Mon 10:00 UTC · Yui.** Typed "Koenji": not a town in the place list, so the server asked OpenStreetMap and found the neighbourhood. 1 km² zone.
- **D0 Mon 10:00 UTC · Mariana.** Pasted a Google Maps link instead of GPS. Looked around without a circle.
- **D0 Mon 10:00 UTC · Dani, Rui.** Joined Third Floor with Alice’s code and skipped “what’s on your mind”. Third Floor is now four, enough for the Mole.
- **D0 Mon 18:00 UTC · Alice.** Made "Quiz night, Thu 8pm". Bob tapped I’m in and replied; the server queued a notification to Alice only, because plans ping the people going.
- **D1 Tue 08:00 UTC · Alice.** Ticked her run (1 of 3).
- **D1 Tue 08:00 UTC · Bob.** Tried to post to the City feed: locked until his circle had met. He and Alice scanned phones in the kitchen, then the post went up. Erin (Night Shift) tapped “we’re in”; Bob sees “Wants in: Night Shift”, never a number.
- **D1 Tue 08:00 UTC · Bob.** Did the daily dare (“order your coffee in the voice of a movie trailer”), added a photo: it’s in Third Floor’s clips for 24 hours. Then cheered Alice’s run.
- **D1 Tue 08:00 UTC · Carol.** Solved the Decode on the second try, 1st in Lisbon (0.5 s with a wrong guess). Kenji solved it in Tokyo the same morning and was 1st there.
- **D1 Tue 19:00 UTC · Alice.** Bob asked for help carrying a wardrobe (2 h). Alice said she’d do it, did it in an hour and adjusted it; Bob confirmed. Ledger: Alice +1 h, Bob −1 h. The server keeps the −5 h limit and won’t let anyone log hours for themselves.
- **D1 Tue 19:00 UTC · Alice.** Started “Porto weekend”, pledge-then-pay, €60 each, goes ahead at 3. Bob and Dani pledged from their Home screens; Bob paid by bank transfer and Alice confirmed it landed. INSANE never touched the money.
- **D2 Wed 12:00 UTC · Carol.** Hosted a two-key drop at Ler Devagar for Thursday 18:00, tapped the exact door on the map. Alice, Bob and Erin (10 km radius) see it; Tokyo and São Paulo don’t.
- **D3 Thu 10:40 UTC · Yui.** Checked in at Kenji’s record-bar offer. After it closed she ran the draw: it spun through the circles and landed on Koenji Six, with how to check it.
- **D3 Thu 17:10 UTC · Bob.** Got the 15-minute notice, typed the wrong code first (refused), then the right one: checked in 0.2 s after typing. Locked until Erin from Night Shift arrived, then it opened for both. A DROP stamp went into his passport.
- **D4 Fri 20:00 UTC · Alice.** Proposed a Mission for Saturday afternoon: “The Slow Walk”, with three secret briefings and the exact spot under the arch. The map shows a 350 m circle, nudged so it doesn’t give the spot away. Carol confirmed for Night Shift and said she’s in; she got her briefing, not the spot.
- **D5 Sat 00:05 UTC · Bob.** Wrote an unsigned Midnight message. Until midnight the server sent nobody its text, and it never stored who wrote it. At 00:00 it went out; the notification was held because everyone was in quiet hours.
- **D5 Sat 13:30 UTC · Erin.** Opened Night Shift’s Bridges Trail from home and tapped Stamp: refused, her phone said she was kilometres away. At the river steps it stamped by GPS. After the trail closed the server refused late stamps.
- **D5 Sat 15:00 UTC · Carol.** At 13:30 the spot appeared on her card (“under the arch on the river side”); people who hadn’t said yes still saw only the area. After the walk she told INSANE it happened as described, which keeps Third Floor’s Reliability.
- **D5 Sat 16:00 UTC · Alice.** Met Carol from the other circle. Scanned her QR with the phone camera; INSANE opened with the code and connected them. A MET stamp, then a first direct message.
- **D7 Mon 09:00 UTC · Bob.** Picked up the Mole for week 2: three tasks from INSANE’s list, visible only to him. The store says only “someone is the Mole”. Alice guessed Bob; Dani and Rui guessed each other.
- **D8 Tue 12:00 UTC · Bob.** Went dark for 6 hours. Alice posted in Quiz night meanwhile; the server held his notification. Carol switched on calm mode: no counts, no dots, less on Today.
- **D10 Thu 17:00 UTC · Tunde.** Calls were locked until he and Ada scanned phones at five-a-side. Then he sent a call for two more players. Lagos has only one circle in the test, so nobody could answer: the call waits. (A real finding: calls need a second circle nearby.)
- **D13 Sun 21:05 UTC · Bob.** Sunday 21:00 he revealed himself: tasks done, one vote out of three. He got away with it.

## Timings

| Person | Sign-in (email to signed in) | Onboarding (name to first screen) | Taps |
|---|---|---|---|
| Bob | 0.6 s | 2.4 s | 11 |
| Carol | 0.5 s | 2.5 s | 11 |
| Erin | 0.6 s | 2.3 s | 10 |
| Kenji | 0.6 s | 4.9 s | 11 |
| Yui | 0.6 s | 5.9 s | 11 |
| Tunde | 0.6 s | 2.5 s | 11 |
| Ada | 0.6 s | 2.2 s | 10 |
| Mariana | 0.6 s | 4.4 s | 11 |
| Dani | 0.5 s | 2.1 s | 10 |
| Rui | 0.6 s | 2.2 s | 10 |

Scripted taps are faster than a person's; read these as relative, not absolute.

## Checks

- ✅ sign-in: a wrong code is refused with a clear message
- ✅ sign-in: the right code signs Alice in and starts onboarding
- ✅ session survives a reload (cookie, 60 days)
- ✅ invite QR link fills the code: Erin lands in Night Shift
- ✅ Amadora resolves to Lisbon for the feed and Decode (Lisbon)
- ✅ street-level search (OpenStreetMap) finds Kōenji; Yui’s city is Tokyo (Tokyo near Asagaya-minami)
- ✅ Ikeja resolves to Lagos (Lagos)
- ✅ a pasted Google Maps link places Mariana on Av. Paulista, São Paulo (São Paulo)
- ✅ privacy: Bob can’t read Alice’s exact pin, even asking the server directly (403)
- ✅ privacy: Alice’s public profile has a 1 km² square, no coordinates
- ✅ privacy: Alice can read her own pin
- ✅ privacy: zone-only Bob has no pin stored at all
- ✅ privacy: nobody can list someone else’s private space (403)
- ✅ each person’s sign-in took under 4 s (alice undefinedms, bob 624ms, carol 524ms, erin 578ms, kenji 630ms, yui 597ms, tunde 562ms, ada 579ms, mariana 618ms, dani 544ms, rui 576ms)
- ✅ Bob sees the new plan message on Today
- ✅ the bell counts it
- ✅ Alice sees Bob going, live
- ✅ server notified Alice (going) of Bob’s reply, nobody else ({"title":"Bob in Quiz night","body":"in, I’ll bring snacks","tag":"t:g7ey8pz3zbphmrb9","at":1792432806275})
- ✅ City feed posting is locked until the circle has met in person
- ✅ scanning phones in the kitchen marks Third Floor as met in person ({"u_NQ9BrUwuLTHQGK":true,"u_P8u6Va66KIVKCm":true})
- ✅ Bob’s circle sees which circle wants in, no counts anywhere
- ✅ a stranger can’t edit a post or react for someone else ({"ok":true})
- ✅ Tokyo’s feed doesn’t show Lisbon posts
- ✅ daily dare done with a photo; it sits in the circle’s clips for 24 h ([86400000])
- ✅ the server refuses a “clip” that isn’t a photo (400)
- ✅ Alice sees Bob’s dare photo in the clips
- ✅ Alice sees Bob cheered her run
- ✅ Decode: Carol solves first in Lisbon
- ✅ the solve gets a stamp-and-confetti moment
- ✅ server refuses a forged Decode solve with the wrong answer ({"status":400,"body":{"code":"failed_precondition","message":"wrong_answer"}})
- ✅ server refuses a solve filed under someone else’s name (403)
- ✅ Decode is per city: Kenji is 1st in Tokyo, not 2nd
- ✅ the circle is notified of a favor ask
- ✅ only the person helped can log a favor (Alice can’t confirm her own work) (403)
- ✅ ledger after one favor: Alice +1 h, Bob −1 h
- ✅ mutual credit limit: Bob can log favors received down to −5 h, not past it (200 then 400 {"code":"failed_precondition","message":"That would take you below −5 h."})
- ✅ nobody can log a favor in someone else’s name to pay themselves (403)
- ✅ the pot is in euros because Alice is in Portugal
- ✅ third pledge meets the goal
- ✅ Bob can’t confirm his own payment; only the organiser can ({"u_P8u6Va66KIVKCm":"wait"})
- ✅ host sees a 6-character door code (FNRTNJ)
- ✅ server hides the door code from everyone but the host
- ✅ Alice (exact, 5 km) sees the drop
- ✅ Erin (8 km away, 10 km radius) sees it
- ✅ Tokyo never sees a Lisbon drop
- ✅ the draw runs, lands, and explains how anyone can check it
- ✅ 15 minutes before, people within their distance get a notification ([{"title":"Ler Devagar opens in 15 min","body":"A free drink for everyone there · 6.5 km away","tag":"drop:fpbhg5fb89d5b97a","at":1792687806775}])
- ✅ …and people in Tokyo don’t
- ✅ wrong door code is refused (checked by the server)
- ✅ a hand-made client can’t check in without the code ({"code":"failed_precondition","message":"wrong_code"})
- ✅ right code checks Bob in; the server stamps it verified
- ✅ two-key stays locked with one circle
- ✅ two-key unlocks when a second circle arrives, live for Bob
- ✅ Bob’s passport gets a DROP stamp
- ✅ a day ahead, the server hides the exact spot from people in other circles, even ones who said yes ({"spot":"","roles":3})
- ✅ people who haven’t said yes don’t get the secret briefings
- ✅ another circle can confirm for itself, not rename a Mission or confirm for others ({"unp7taic4n":"Night Shift"})
- ✅ Carol gets a secret briefing on the card
- ✅ before midnight the server sends no text, and no author is stored
- ✅ sealed text stays on the server until it opens
- ✅ after midnight (Lisbon) the text is out
- ✅ Midnight goes out at 00:00, held for quiet hours (Alice’s are 23:00–08:00) ([{"uid":"u_NQ9BrUwuLTHQGK","title":"Midnight","held":"quiet","at":1792800314450},{"uid":"u_P8u6Va66KIVKCm","title":"Midnight","held":"quiet","at":1792800314450}])
- ✅ stamping from home is refused: Erin’s phone says she’s 7 km away (Your phone says you’re 9.4 km from River steps. Get within 150 m.)
- ✅ at the river steps the stamp is checked by GPS ({"0":{"at":1792836013039,"how":"gps"}})
- ✅ two hours before, the exact spot goes to Carol because she said yes (Under the arch on the river side)
- ✅ …and still not to anyone who didn’t
- ✅ the server refuses stamps after the trail closes (400)
- ✅ afterwards, people who were in say whether it happened as described
- ✅ meet shows a QR code and the 6 digits
- ✅ nobody can make a “met” without being shown the code ({"code":"failed_precondition","message":"expired_code"})
- ✅ scanning the QR connects Alice and Carol
- ✅ direct messages work only after meeting
- ✅ Sunday shows “Your week” from the private timeline (INSANE 3 Third Floor Lisbon · 1 km² square A Sunday  1 thing today · Lisbon · 3 of your circle here now  Decode · week 43 A=1, B=2 … Z=26. Decode: 13 · 21 · 19 · 5 · 21 · 13 2 solved in Lisbon · answe)
- ✅ Bob is notified he’s been dared
- ✅ Bob accepts and does the dare; only he could mark it done
- ✅ Bob takes the Mole for week 2 and sees three secret tasks
- ✅ the server stores no name on the Mole ({"at":1793005203919,"n":3})
- ✅ nobody but the Mole can reveal the Mole (403)
- ✅ Go dark blanks INSANE with a countdown and a breathing circle
- ✅ while Bob is dark, the server holds his notifications
- ✅ calm mode hides the bell count and red dots
- ✅ Today shows who in your circle is here now
- ✅ a call from your own circle can’t be answered by you (it needs another circle)
- ✅ Erin (10 km) sees the new Santos swap box, 8 km away
- ✅ shrinking the distance to 2 km takes the 8 km drop off Erin’s list and says how many are further out (INSANE Night Shift Lisbon · 4 km² square E Lisbon  Drops within 2 km, Missions, trails, the Decode, the feed, and calls from other circles.  Map Feed Calls League Decode · week 44 A place is hiding in this line: “the cab ridge road”. 0 solved in Lisbon · answer out in 1d 11h + − ◎ © OpenStreetMap co)
- ✅ owner’s Test results count all eleven people (11 people)
- ✅ Sunday 21:00: Bob reveals himself; 1 of 3 guessed him, so he got away with it (was the Mole. 1 of 3 tasks, 1 vote out of 3. Got away with it.)
- ✅ delete removes Mariana’s profile from the server
- ✅ sign out returns to the email screen
- ✅ no sideways scroll at 400 px: alice (400)
- ✅ no sideways scroll at 400 px: kenji (400)
- ✅ no script errors in eleven browsers over two weeks