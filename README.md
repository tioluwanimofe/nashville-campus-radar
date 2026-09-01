# Nashville Campus Radar

Find free food and study spots on Nashville campuses today.

Campus Radar scrapes public event calendars from Nashville universities, uses an LLM to
read each listing and answer the questions students actually care about — *is there food,
is it free, am I allowed in?* — scores the results, and shows a ranked plan for the day.

Every claim is traceable: the raw text that was scraped, the exact phrase the model used
as food evidence, and the source URL are all stored and viewable per event. There is **no
seeded or sample data anywhere in this app** — if a source is down or blocks bots, the
admin view says so plainly.

---

## Contents

- [Features](#features)
- [Technology](#technology)
- [Architecture](#architecture)
- [Data flow](#data-flow)
- [Database schema](#database-schema)
- [API surface](#api-surface)
- [Scraping and extraction internals](#scraping-and-extraction-internals)
- [Ranking](#ranking)
- [Security model](#security-model)
- [Running locally](#running-locally)
- [Project layout](#project-layout)
- [Known limits](#known-limits)

---

## Features

| Feature | Where | Notes |
|---|---|---|
| **Today** — ranked "where should I eat and study" plan | `/` | Top picks, best campus of the day, confirmed-meal count |
| **Intent chips** instead of a search bar | `/` | `food_now`, `food_today`, `this_week`, `study`, `open_to_all` — a fixed set always has a defined answer; free-text search over ~90 events mostly returns nothing |
| **Feed** — filterable index | `/feed` | Filter by food-only, free-only, campus, eligibility, confidence |
| **Provenance** per event | `/feed` | Raw scraped text, food evidence phrase, source URL, extraction timestamp |
| **Student submissions** | `/submit` | Paste a link or flyer text; queued with zero AI cost, an admin spends one call to draft it, a human publishes it |
| **Ground-truth feedback** | event cards | "I went / there was food / I already knew" — one row per browser per event, measures actual discovery rate |
| **Admin console** | `/admin` | Run one source or all, add/disable sources, run log with the exact raw text the model read, submission review queue, signal summary |
| **Manual** | `/manual` | User-facing how-to; deliberately excludes pipeline internals and the scoring formula |
| **Six switchable themes** | header RGB switch | CSS custom properties only, persisted in `localStorage`, applied pre-paint to avoid a flash |

## Technology

- **Runtime / package manager:** Bun 1.3, Bun workspaces + Turborepo
- **Frontend:** React 19, Vite 7, Wouter (routing), Tailwind CSS 4, TanStack Query, lucide-react
- **API:** Hono (`/api/*`) + oRPC procedures (`/api/rpc/*`), end-to-end typed
- **Validation:** Zod 4 (shared between API input schemas and the LLM output schema)
- **Database:** Turso / libSQL (SQLite) via Drizzle ORM + drizzle-kit
- **AI:** Vercel AI SDK (`ai` v7) `generateObject` against an OpenAI-compatible gateway, model `google/gemini-3-flash`
- **Scraping:** plain `fetch` with a browser UA + hand-rolled RSS / JSON-LD / WordPress-Tribe / HTML-chunk parsers (no headless browser)
- **Other clients:** Expo (mobile) and Electron (desktop) packages ship with the template and are unused by this app

## Architecture

Monorepo, one deployable service:

```
packages/web        Vite dev server serves BOTH the React app (/*) and the Hono API (/api/*)
  src/api           Hono app, oRPC router, Drizzle schema, scraping + extraction libs
  src/web           React SPA (pages, components, queries)
packages/mobile     Expo client (template default, not used by Campus Radar)
packages/desktop    Electron shell around the web app (template default, not used)
```

Ports are fixed in `__ports.cjs` — web `4200`, mobile `4300`, desktop `4400`.

Typing runs end to end: `packages/web/src/api/index.ts` exports `AppRouter`, and the web
client (`src/web/lib/api.ts`) consumes it through the typed oRPC client, so a route
signature change is a compile error in the UI. Query/mutation options live in
`src/web/queries/*` — one file per feature — and components import them.

Files prefixed with `__` (`__core/app.ts`, `__client.ts`, `vite/__plugins/*`) are template
plumbing and should not be edited.

## Data flow

```
                        ┌─────────────────────────── admin only (spends credits) ───┐
sources table           │                                                            │
  │  seeded from        ▼                                                            │
  │  lib/source-seeds  fetchPage()            buildCandidates()          extractEvents()
  │                    lib/fetcher.ts   ─►    lib/parsers.ts       ─►    lib/extract.ts
  │                    HTTP + browser UA      rss | tribe | jsonld       gemini-3-flash
  │                    never throws;          | html text chunks         generateObject
  │                    failures recorded             │                    + zod schema
  │                                                  ▼                          │
  │                                          raw_events  (verbatim, forever)    │
  │                                                  │                          ▼
  └──────────────────────────────────────────────►  runs  ◄──────────  scoreEvent()
                        one row per source per run                            │
                        http status, bytes, counts, error                     ▼
                                                                          events table
                                                                     (dedupeKey unique)
                                                                              │
student paste ─► submissions (queued, no AI) ─► admin drafts (1 AI call) ─────┤
                                                human publishes ──────────────┘
                                                                              │
                                     free reads ─────────────────────────────►│
                          Today / Feed / provenance / stats (no AI, no cost)   │
                                                                              ▼
                                            event_feedback + intent_taps (ground truth)
```

Key invariants:

1. **Raw before refined.** Nothing reaches `events` without a `raw_events` row (scraper) or
   a `submissions` row (human) holding the verbatim input it came from.
2. **Evidence or no claim.** The model may only set `hasFood: true` when it can quote a
   verbatim `foodEvidence` phrase from the text; otherwise the flag is false.
3. **Fail visibly.** Fetch and parse failures are written to `runs` and surfaced in Admin
   rather than being swallowed or replaced with placeholder events.
4. **Reads are free.** Every visitor-facing query hits SQLite only. AI spend happens solely
   in `pipeline.ts` and `submit-extract.ts`, both behind the admin wall.

## Database schema

`packages/web/src/api/database/schema.ts` (Drizzle, SQLite):

| Table | Purpose | Notable columns |
|---|---|---|
| `sources` | A place events are published | `kind` (`html`/`rss`/`tribe`/`jsonld`), `url` unique, `campusLat/Lng`, `enabled`, last-run status counters |
| `raw_events` | Exactly what came off the wire, pre-AI | `rawText`, `detailUrl`, `fetchedAt`, `runId`, `extracted` |
| `events` | AI-extracted, scored event | `dedupeKey` unique, `hasFood`, `foodType`, `foodEvidence`, `foodConfidence`, `foodValue` 0-4, `isFree`, `eligibility`, `academicValue`, `networkingValue`, `score`, `rawEventId` |
| `submissions` | Student-pasted tip | `rawInput` kept forever, `status` `queued`→`drafted`→`published`/`failed`, `draftJson`, `eventId` |
| `event_feedback` | Ground truth from a human who went | `wentThere`, `hadFood`, `knewAlready`, `clientId`; unique on (event, client) so refreshes can't inflate counts |
| `intent_taps` | Which intent chip was pressed and how many results it returned | a tap with `resultCount: 0` is a product failure we want visible |
| `runs` | One scrape+extract execution per source | `httpStatus`, `bytes`, `candidateCount`, `eventCount`, `foodCount`, `note`, `error` |

Apply with `bun run db:push` (drizzle-kit) from `packages/web`.

## API surface

All procedures are oRPC, composed in `src/api/index.ts`. 🔒 = requires `adminKey`.

**`events`** — `today` (ranked day plan + best campus) · `discover` (intent chips) ·
`feed` (filtered index) · `stats` · `provenance`

**`sources`** — `list` · `add` 🔒 · `toggle` 🔒 · `remove` 🔒 · `run` 🔒 · `runAll` 🔒 ·
`checkKey` · `runs` (run log) · `rawForRun`

**`submissions`** — `queue` (free, no AI) · `extract` 🔒 · `extractQueued` 🔒 ·
`publish` 🔒 · `list` · `queueCount` · `remove` 🔒

**`signals`** — `feedback` · `mine` · `intent` · `summary`

**`ping`** — health check. The template also exposes `GET /api/health`.

## Scraping and extraction internals

`lib/fetcher.ts` — plain `fetch` with a desktop Chrome user agent, 25 s abort timeout.
Never throws: failures come back as `{ ok: false, status, error }` so the run log can show
them. Also provides `htmlToText`, `decodeEntities`, `absoluteUrl`.

`lib/parsers.ts` — four strategies producing a common `Candidate { title, rawText, detailUrl }`:

- `parseRss` — RSS/Atom, with LiveWhale extensions (`livewhale:date_time`, `all_day`,
  `location`, `categories`) folded into the raw text
- `parseTribe` — WordPress "The Events Calendar" JSON API
- `parseJsonLd` — schema.org `Event` objects embedded in a page
- `parseHtmlChunks` — last resort: strip to text and chunk the listing page

`lib/pipeline.ts` — orchestration. Picks a strategy by `source.kind` (HTML sources try
JSON-LD first, then fall back to chunks), caps at 60 items per feed, batches **12 candidates
per LLM call**, writes `raw_events`, extracts, scores, dedupes, and closes the `runs` row
with status `ok` / `partial` / `error`.

`lib/extract.ts` — one `generateObject` call per batch against a Zod schema covering title,
summary, start/end ISO, location, `hasFood`, `foodType`, `foodEvidence` (must be verbatim),
`foodConfidence` 0-1, `foodValue` 0-4, `isFree`, `eligibility`, `registrationRequired`,
`academicValue` 0-5, `networkingValue` 0-5.

`lib/submit-extract.ts` — single-item version for student pastes. Additionally returns
`isEvent` + `rejectReason` (junk gets rejected instead of becoming a fake event) and a
`missing[]` list of fields the text never contained.

`dedupeKey = org | normalized title | start date` with a unique index, so re-running a
source updates instead of duplicating.

## Ranking

`scoreEvent()` in `lib/pipeline.ts`:

```
food   = hasFood ? foodValue * 10 * foodConfidence : 0
value  = academicValue * 1.5 + networkingValue * 1.5
score  = (food + value) * eligibilityWeight * (isFree ? 1 : 0.55)

eligibilityWeight: public / students_welcome 1.0 · unknown 0.75 · school_only 0.5 · invite_only 0.2
```

Food first, then how usable the event actually is. The formula is intentionally kept out of
the public manual.

## Security model

- **No user accounts.** Alpha needs a wall between the few procedures that cost money and
  the many that don't, not an auth system.
- `lib/admin.ts` `assertAdmin()` guards every credit-spending procedure against
  `process.env.ADMIN_KEY`. It **fails closed**: if `ADMIN_KEY` is unset, nobody — including
  the operator — can trigger a scrape or an extraction.
- `/admin` renders blank until a valid key is entered; `sources.checkKey` validates without
  spending anything.
- The admin key is sent per-procedure and held only in the admin page's local state.
- No secrets are committed. `.env` is gitignored; copy `.env.example` and fill it in.

## Running locally

Prerequisites: [Bun](https://bun.sh) 1.3+. A Turso database (or any libSQL URL) and an
OpenAI-compatible AI gateway for the extraction step.

```bash
git clone <this-repo>
cd nashville-campus-radar
bun install

cp .env.example .env      # fill in DATABASE_URL, AI_GATEWAY_*, ADMIN_KEY

cd packages/web
bun run db:push           # create the tables
cd ../..

bun run dev               # http://localhost:4200
```

Then:

1. Open `/admin`, enter your `ADMIN_KEY`.
2. Seed sources if the table is empty, then hit **Run all** — this is the step that spends
   AI credits.
3. `/` and `/feed` fill in once the run finishes. Reads never call the model.

Other commands:

```bash
bun run build       # build every package (run before shipping)
bun run typecheck
bun run lint
bun run start       # pm2 production start (ecosystem.config.cjs)
bun run kill:port   # free port 4200
```

Without an AI gateway the app still runs, and scraping still records `raw_events` and run
diagnostics — extraction is what fails, and the run log will show it.

## Project layout

```
.
├── __ports.cjs                    fixed service ports (web 4200)
├── package.json                   workspace scripts (dev/build/db:*)
├── turbo.json                     task graph
├── docs/
│   ├── DESIGN.md                  design system: type, color tokens, six themes, layout
│   └── BUILD-NOTES.md             build log + real scan results + next increments
└── packages/
    ├── web/
    │   ├── drizzle.config.ts
    │   ├── public/                all static assets (logo, favicons, og-image)
    │   └── src/
    │       ├── api/
    │       │   ├── index.ts               router composition + Hono app
    │       │   ├── database/schema.ts     Drizzle tables
    │       │   ├── routes/                events, sources, submissions, signals, ping
    │       │   └── lib/                   source-seeds, fetcher, parsers, extract,
    │       │                              pipeline, submit-extract, admin
    │       └── web/
    │           ├── app.tsx                Wouter routes
    │           ├── pages/                 index (Today), feed, submit, admin, manual
    │           ├── components/            layout, chips, event-feedback, draft-review,
    │           │                          working-principle, theme-switch
    │           ├── queries/               one TanStack Query file per feature
    │           └── styles.css             Tailwind 4 + theme custom properties
    ├── mobile/                    Expo client (template default, unused)
    └── desktop/                   Electron shell (template default, unused)
```

## Known limits

- **JS-rendered calendars return nothing.** Belmont, Trevecca and TSU serve HTTP 200 but
  build their event lists client-side, so the text fetcher finds nothing event-shaped.
  A headless-browser fetcher is the fix.
- **Some hosts block bots** — Eventbrite returned 405, Nashville Public Library 403.
- **Source concentration:** Vanderbilt's LiveWhale RSS supplied roughly 60 of the ~76 events
  in the reference scan. Student submissions exist mainly to cover the campuses scraping
  can't reach.
- **Dates come from the model**, not a date parser, so odd formats can land as `null`
  (`timeText` preserves the string as printed).
- No scheduler: scans are triggered manually from Admin.
