import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";

const eventColumns = {
  id: schema.events.id,
  title: schema.events.title,
  org: schema.events.org,
  summary: schema.events.summary,
  location: schema.events.location,
  startsAt: schema.events.startsAt,
  endsAt: schema.events.endsAt,
  timeText: schema.events.timeText,
  sourceUrl: schema.events.sourceUrl,
  hasFood: schema.events.hasFood,
  foodType: schema.events.foodType,
  foodEvidence: schema.events.foodEvidence,
  foodConfidence: schema.events.foodConfidence,
  foodValue: schema.events.foodValue,
  isFree: schema.events.isFree,
  eligibility: schema.events.eligibility,
  registrationRequired: schema.events.registrationRequired,
  academicValue: schema.events.academicValue,
  networkingValue: schema.events.networkingValue,
  score: schema.events.score,
  sourceName: schema.sources.name,
  extractedAt: schema.events.extractedAt,
};

function dayBounds(dayIso: string) {
  const start = new Date(`${dayIso}T00:00:00`);
  const end = new Date(`${dayIso}T23:59:59`);
  return { start, end };
}

export const events = {
  /** Ranked plan for one day, plus the "best campus" call-out. */
  today: base
    .input(z.object({ day: z.string().optional(), foodOnly: z.boolean().default(false) }))
    .handler(async ({ input }) => {
      const day = input.day ?? new Date().toISOString().slice(0, 10);
      const { start, end } = dayBounds(day);
      const rows = await db
        .select(eventColumns)
        .from(schema.events)
        .leftJoin(schema.sources, eq(schema.sources.id, schema.events.sourceId))
        .where(
          and(
            isNotNull(schema.events.startsAt),
            gte(schema.events.startsAt, start),
            lte(schema.events.startsAt, end),
            input.foodOnly ? eq(schema.events.hasFood, true) : undefined,
          ),
        )
        .orderBy(schema.events.startsAt);

      const byOrg = new Map<string, { org: string; events: number; foodEvents: number; foodScore: number }>();
      for (const r of rows) {
        const entry = byOrg.get(r.org) ?? { org: r.org, events: 0, foodEvents: 0, foodScore: 0 };
        entry.events += 1;
        if (r.hasFood) {
          entry.foodEvents += 1;
          entry.foodScore += r.foodValue * r.foodConfidence;
        }
        byOrg.set(r.org, entry);
      }
      const campuses = [...byOrg.values()].sort((a, b) => b.foodScore - a.foodScore || b.events - a.events);

      const confirmedMeals = rows.filter((r) => r.hasFood && r.foodConfidence >= 0.6).length;
      return {
        day,
        events: rows.sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0)),
        topPicks: [...rows].sort((a, b) => b.score - a.score).slice(0, 3),
        campuses,
        bestCampus: campuses[0] ?? null,
        confirmedMeals,
        foodEvents: rows.filter((r) => r.hasFood).length,
      };
    }),

  /**
   * Preset intents instead of a search box. With ~90 events indexed, a free-text
   * search returns nothing most of the time and teaches the user the app is
   * broken. A fixed set of intents always has a defined answer, and each one is
   * a question we actually want measured.
   */
  discover: base
    .input(
      z.object({
        intent: z.enum(["food_now", "food_today", "this_week", "study", "open_to_all"]),
        limit: z.number().default(40),
      }),
    )
    .handler(async ({ input }) => {
      const now = new Date();
      const todayIso = now.toISOString().slice(0, 10);
      const { start, end } = dayBounds(todayIso);
      const weekEnd = new Date(start.getTime() + 7 * 86_400_000);

      const where = {
        food_now: and(
          eq(schema.events.hasFood, true),
          gte(schema.events.startsAt, now),
          lte(schema.events.startsAt, end),
        ),
        food_today: and(
          eq(schema.events.hasFood, true),
          gte(schema.events.startsAt, start),
          lte(schema.events.startsAt, end),
        ),
        this_week: and(gte(schema.events.startsAt, start), lte(schema.events.startsAt, weekEnd)),
        // "Study spots" = something academically useful you can sit in on.
        study: and(
          gte(schema.events.academicValue, 3),
          gte(schema.events.startsAt, start),
          lte(schema.events.startsAt, weekEnd),
        ),
        open_to_all: and(
          inArray(schema.events.eligibility, ["public", "students_welcome"]),
          gte(schema.events.startsAt, start),
          lte(schema.events.startsAt, weekEnd),
        ),
      }[input.intent];

      const rows = await db
        .select(eventColumns)
        .from(schema.events)
        .leftJoin(schema.sources, eq(schema.sources.id, schema.events.sourceId))
        .where(and(isNotNull(schema.events.startsAt), where))
        .orderBy(desc(schema.events.score))
        .limit(input.limit);

      return {
        intent: input.intent,
        count: rows.length,
        events: rows.sort(
          (a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0),
        ),
      };
    }),

  /** Everything upcoming, with filters. */
  feed: base
    .input(
      z.object({
        org: z.string().optional(),
        foodOnly: z.boolean().default(false),
        freeOnly: z.boolean().default(false),
        eligibility: z.string().optional(),
        minConfidence: z.number().default(0),
        includeUndated: z.boolean().default(true),
        limit: z.number().default(120),
      }),
    )
    .handler(async ({ input }) => {
      const now = new Date(new Date().toISOString().slice(0, 10));
      const rows = await db
        .select(eventColumns)
        .from(schema.events)
        .leftJoin(schema.sources, eq(schema.sources.id, schema.events.sourceId))
        .where(
          and(
            input.org ? eq(schema.events.org, input.org) : undefined,
            input.foodOnly ? eq(schema.events.hasFood, true) : undefined,
            input.freeOnly ? eq(schema.events.isFree, true) : undefined,
            input.eligibility ? eq(schema.events.eligibility, input.eligibility) : undefined,
            gte(schema.events.foodConfidence, input.minConfidence),
          ),
        )
        .orderBy(desc(schema.events.score))
        .limit(input.limit);

      const upcoming = rows.filter(
        (r) => (r.startsAt ? r.startsAt >= now : input.includeUndated),
      );
      return upcoming.sort((a, b) => {
        const at = a.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bt = b.startsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return at - bt;
      });
    }),

  /** Header counters + the org list used by the filters. */
  stats: base.handler(async () => {
    const [totals] = await db
      .select({
        events: sql<number>`count(*)`,
        food: sql<number>`sum(case when ${schema.events.hasFood} then 1 else 0 end)`,
        confirmed: sql<number>`sum(case when ${schema.events.hasFood} and ${schema.events.foodConfidence} >= 0.6 then 1 else 0 end)`,
        lastExtract: sql<number | null>`max(${schema.events.extractedAt})`,
      })
      .from(schema.events);
    const orgs = await db
      .select({ org: schema.events.org, count: sql<number>`count(*)` })
      .from(schema.events)
      .groupBy(schema.events.org)
      .orderBy(desc(sql`count(*)`));
    const [sourceCounts] = await db
      .select({
        total: sql<number>`count(*)`,
        healthy: sql<number>`sum(case when ${schema.sources.lastStatus} = 'ok' then 1 else 0 end)`,
      })
      .from(schema.sources);
    return {
      events: Number(totals?.events ?? 0),
      food: Number(totals?.food ?? 0),
      confirmed: Number(totals?.confirmed ?? 0),
      lastExtract: totals?.lastExtract ? new Date(Number(totals.lastExtract) * 1000) : null,
      orgs: orgs.map((o) => ({ org: o.org, count: Number(o.count) })),
      sources: { total: Number(sourceCounts?.total ?? 0), healthy: Number(sourceCounts?.healthy ?? 0) },
    };
  }),

  /** Full provenance for one event: what the model decided and the raw text it read. */
  provenance: base.input(z.object({ id: z.number() })).handler(async ({ input }) => {
    const [row] = await db
      .select({
        event: schema.events,
        raw: schema.rawEvents,
        source: schema.sources,
      })
      .from(schema.events)
      .leftJoin(schema.rawEvents, eq(schema.rawEvents.id, schema.events.rawEventId))
      .leftJoin(schema.sources, eq(schema.sources.id, schema.events.sourceId))
      .where(eq(schema.events.id, input.id));
    return row ?? null;
  }),
};
