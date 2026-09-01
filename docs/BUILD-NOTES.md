# Nashville Campus Radar — POC build

## Decisions
- Managed stack app at /home/user/campus-radar (web only, port 4200)
- Light "food app" design (see design.md)
- Pipeline: fetch -> parse (rss | tribe | jsonld | html text chunks) -> LLM extract+classify -> events table
- Model: google/gemini-3-flash via AI gateway, generateObject with zod schema
- No fake/sample data. Failed sources are shown honestly in Admin.

## Live scan result (Aug 25, 2026)
- Vanderbilt LiveWhale RSS: ok, 60 candidates -> 59 events, 17 with food
- Lipscomb Upcoming Events: ok, 15 events, 2 food
- Lipscomb Student Events: ok, 3 events, 1 food
- Belmont / Trevecca / TSU: fetched 200 but 0 event-shaped items extracted
- Fisk WP tribe API: partial (calendar currently empty)
- Eventbrite: HTTP 405 blocked | Nashville Public Library: HTTP 403 blocked
- Totals: 76 events indexed, 19 with confirmed food, 6/9 sources healthy

## Done
- [x] app_init, design.md, schema.ts, db:push
- [x] lib: source-seeds, fetcher, parsers, extract, pipeline
- [x] routes: sources.ts, events.ts, router composed
- [x] frontend: styles/fonts, layout, Today, Feed, Admin pages + queries
- [x] app.tsx routes + RunableBadge removed, metadata cleaned
- [x] bun run build passes
- [x] real scan run, all three pages verified via screenshots
- [x] zip at /home/user/nashville-campus-radar.zip

## Possible next increments
- Daily email / Telegram digest
- Distance + map view from campus coords (already stored)
- Agentic source discovery (find new event pages automatically)
- Headless-browser fetcher for JS-rendered calendars (TSU) and blocked sources
