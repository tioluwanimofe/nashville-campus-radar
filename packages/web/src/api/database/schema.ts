import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** A place events are published: a campus calendar, a feed, a listing page. */
export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  org: text("org").notNull(),
  kind: text("kind").notNull().default("html"), // html | rss | tribe | json | coursedog (jsonld is an auto-detected sub-case of html)
  url: text("url").notNull().unique(),
  campusLat: real("campus_lat"),
  campusLng: real("campus_lng"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  lastStatus: text("last_status"), // ok | partial | error
  lastError: text("last_error"),
  lastCandidateCount: integer("last_candidate_count").notNull().default(0),
  lastEventCount: integer("last_event_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/** Exactly what came off the wire, before any AI touched it. Keeps the pipeline auditable. */
export const rawEvents = sqliteTable(
  "raw_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id").notNull(),
    runId: integer("run_id").notNull(),
    title: text("title"),
    rawText: text("raw_text").notNull(),
    detailUrl: text("detail_url"),
    fetchedAt: integer("fetched_at", { mode: "timestamp" }).notNull(),
    extracted: integer("extracted", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("raw_events_run_idx").on(t.runId)],
);

/** AI-extracted, scored event. Every field traces back to rawEventId + sourceUrl. */
export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sourceId: integer("source_id").notNull(),
    rawEventId: integer("raw_event_id"),
    dedupeKey: text("dedupe_key").notNull(),

    title: text("title").notNull(),
    org: text("org").notNull(),
    summary: text("summary"),
    location: text("location"),
    startsAt: integer("starts_at", { mode: "timestamp" }),
    endsAt: integer("ends_at", { mode: "timestamp" }),
    timeText: text("time_text"),
    sourceUrl: text("source_url").notNull(),

    hasFood: integer("has_food", { mode: "boolean" }).notNull().default(false),
    foodType: text("food_type"),
    foodEvidence: text("food_evidence"),
    foodConfidence: real("food_confidence").notNull().default(0),
    foodValue: integer("food_value").notNull().default(0), // 0-4, 4 = full meal
    isFree: integer("is_free", { mode: "boolean" }).notNull().default(true),
    eligibility: text("eligibility").notNull().default("unknown"),
    registrationRequired: integer("registration_required", { mode: "boolean" })
      .notNull()
      .default(false),
    academicValue: integer("academic_value").notNull().default(0),
    networkingValue: integer("networking_value").notNull().default(0),
    score: real("score").notNull().default(0),
    extractedAt: integer("extracted_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("events_dedupe_idx").on(t.dedupeKey),
    index("events_starts_idx").on(t.startsAt),
  ],
);

/**
 * A student-pasted tip: a link, a screenshot caption, or free text off a flyer.
 * We keep the raw paste forever so every published event can be traced back to
 * exactly what a human supplied — same provenance rule as the scraper.
 */
export const submissions = sqliteTable(
  "submissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind").notNull().default("text"), // text | url
    rawInput: text("raw_input").notNull(),
    fetchedUrl: text("fetched_url"),
    org: text("org"),
    submitterNote: text("submitter_note"),
    /**
     * queued  = a student pasted it, NO AI has touched it (costs nothing)
     * drafted = an admin spent one AI call and there is a draft to review
     * published | failed
     */
    status: text("status").notNull().default("queued"),
    /** The AI draft, verbatim JSON, so review survives a page reload. */
    draftJson: text("draft_json"),
    extractError: text("extract_error"),
    eventId: integer("event_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("submissions_created_idx").on(t.createdAt)],
);

/**
 * Ground truth from a human who actually walked over there. This is how AI
 * confidence turns into fact, and how we measure the only metric that matters
 * in alpha: would you have found this without Campus Radar?
 */
export const eventFeedback = sqliteTable(
  "event_feedback",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    eventId: integer("event_id").notNull(),
    /** null = not answered. */
    wentThere: integer("went_there", { mode: "boolean" }),
    hadFood: integer("had_food", { mode: "boolean" }),
    /** true = "I already knew about this" → NOT a discovery. */
    knewAlready: integer("knew_already", { mode: "boolean" }),
    /** Anonymous browser id, so one tester can't skew a count by refreshing. */
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [
    uniqueIndex("event_feedback_once_idx").on(t.eventId, t.clientId),
    index("event_feedback_event_idx").on(t.eventId),
  ],
);

/**
 * Which preset intent a student pressed, and how many events it returned.
 * A tap with resultCount 0 is a product failure we want to see, not hide.
 */
export const intentTaps = sqliteTable(
  "intent_taps",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    intent: text("intent").notNull(),
    resultCount: integer("result_count").notNull().default(0),
    clientId: text("client_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("intent_taps_created_idx").on(t.createdAt)],
);

/** One scrape+extract execution, per source. Surfaced honestly in Admin. */
export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  status: text("status").notNull().default("running"), // running | ok | partial | error
  httpStatus: integer("http_status"),
  bytes: integer("bytes"),
  candidateCount: integer("candidate_count").notNull().default(0),
  eventCount: integer("event_count").notNull().default(0),
  foodCount: integer("food_count").notNull().default(0),
  note: text("note"),
  error: text("error"),
});
