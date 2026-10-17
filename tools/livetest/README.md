# Live test drivers (v0.9 planning)

Python Playwright drivers used for docs/CRITIQUES-V09.md. Four personas (Meera, Arjun, Kavya, Ravi) on Pixel 7, iPhone 13 and 1280 px, light + dark.

    DEV=1 OWNER_EMAIL=owner@x.com DB_FILE=/tmp/ins.db PORT=8099 node server/server.js &
    python3 tools/livetest/live.py            # as shipped (no viewport meta)
    python3 tools/livetest/live_viewport.py   # injects <meta name=viewport> to preview the real mobile layout

Both block every host except localhost (fonts, cdnjs QR library, OSM tiles), use system Chromium at /usr/bin/chromium, and write 400 px JPEG screenshots plus an audit (tap targets, contrast, fonts, network bytes). Output paths are set at the top of each file. These are exploration scripts; v0.9's real suites live in test/ per docs/PLAN-V09.md §5.
