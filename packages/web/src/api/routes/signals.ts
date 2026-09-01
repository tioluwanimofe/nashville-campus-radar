import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";

/**
 * Alpha instrumentation. Every procedure here is a plain DB write or read —
 * zero AI calls, zero credits — so it can stay open to every tester.
 */
export const signals = {
  /**
   * One tap from a student who was actually there. `knewAlready: false` is a
   * discovery: the app told them something they had no other way of knowing.
   */
  feedback: base
    .input(
      z.object({
        eventId: z.number(),
        clientId: z.string().min(6),
        wentThere: z.boolean().nullable().default(null),
        hadFood: z.boolean().nullable().default(null),
        knewAlready: z.boolean().nullable().default(null),
      }),
    )
    .handler(async ({ input }) => {
      const values = {
        eventId: input.eventId,
        clientId: input.clientId,
        wentThere: input.wentThere,
        hadFood: input.hadFood,
        knewAlready: input.knewAlready,
      };
      // One row per tester per event, so a refresh can't inflate the numbers.
      // Later answers merge into the same row instead of stacking.
      const [row] = await db
        .insert(schema.eventFeedback)
        .values(values)
        .onConflictDoUpdate({
          target: [schema.eventFeedback.eventId, schema.eventFeedback.clientId],
          set: {
            wentThere: sql`coalesce(${input.wentThere ?? null}, ${schema.eventFeedback.wentThere})`,
            hadFood: sql`coalesce(${input.hadFood ?? null}, ${schema.eventFeedback.hadFood})`,
            knewAlready: sql`coalesce(${input.knewAlready ?? null}, ${schema.eventFeedback.knewAlready})`,
          },
        })
        .returning();
      return row!;
    }),

  /** What this browser has already answered, so the UI shows its own state. */
  mine: base
    .input(z.object({ clientId: z.string().min(6) }))
    .handler(({ input }) =>
      db
        .select({
          eventId: schema.eventFeedback.eventId,
          wentThere: schema.eventFeedback.wentThere,
          hadFood: schema.eventFeedback.hadFood,
          knewAlready: schema.eventFeedback.knewAlready,
        })
        .from(schema.eventFeedback)
        .where(eq(schema.eventFeedback.clientId, input.clientId)),
    ),

  /** Log which preset intent was pressed and whether it returned anything. */
  intent: base
    .input(
      z.object({
        intent: z.string().min(2).max(40),
        resultCount: z.number().int().min(0),
        clientId: z.string().min(6),
      }),
    )
    .handler(async ({ input }) => {
      await db.insert(schema.intentTaps).values(input);
      return { ok: true };
    }),

  /**
   * The alpha scoreboard. Discovery Rate is the north star: of the people who
   * answered, how many would NOT have known about the event otherwise.
   */
  summary: base.handler(async () => {
    const [fb] = await db
      .select({
        responses: sql<number>`count(*)`,
        answeredKnew: sql<number>`sum(case when ${schema.eventFeedback.knewAlready} is not null then 1 else 0 end)`,
        discoveries: sql<number>`sum(case when ${schema.eventFeedback.knewAlready} = 0 then 1 else 0 end)`,
        went: sql<number>`sum(case when ${schema.eventFeedback.wentThere} = 1 then 1 else 0 end)`,
        foodConfirmed: sql<number>`sum(case when ${schema.eventFeedback.hadFood} = 1 then 1 else 0 end)`,
        foodDenied: sql<number>`sum(case when ${schema.eventFeedback.hadFood} = 0 then 1 else 0 end)`,
        testers: sql<number>`count(distinct ${schema.eventFeedback.clientId})`,
      })
      .from(schema.eventFeedback);

    const intents = await db
      .select({
        intent: schema.intentTaps.intent,
        taps: sql<number>`count(*)`,
        empty: sql<number>`sum(case when ${schema.intentTaps.resultCount} = 0 then 1 else 0 end)`,
      })
      .from(schema.intentTaps)
      .groupBy(schema.intentTaps.intent)
      .orderBy(desc(sql`count(*)`));

    const recent = await db
      .select({
        eventId: schema.eventFeedback.eventId,
        title: schema.events.title,
        org: schema.events.org,
        wentThere: schema.eventFeedback.wentThere,
        hadFood: schema.eventFeedback.hadFood,
        knewAlready: schema.eventFeedback.knewAlready,
        aiSaidFood: schema.events.hasFood,
        aiConfidence: schema.events.foodConfidence,
        createdAt: schema.eventFeedback.createdAt,
      })
      .from(schema.eventFeedback)
      .leftJoin(schema.events, eq(schema.events.id, schema.eventFeedback.eventId))
      .orderBy(desc(schema.eventFeedback.id))
      .limit(15);

    /** Where the AI said food and a human on the ground said no. The honest miss list. */
    const contradictions = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.eventFeedback)
      .leftJoin(schema.events, eq(schema.events.id, schema.eventFeedback.eventId))
      .where(and(eq(schema.eventFeedback.hadFood, false), eq(schema.events.hasFood, true)));

    const answeredKnew = Number(fb?.answeredKnew ?? 0);
    const discoveries = Number(fb?.discoveries ?? 0);

    return {
      responses: Number(fb?.responses ?? 0),
      testers: Number(fb?.testers ?? 0),
      went: Number(fb?.went ?? 0),
      foodConfirmed: Number(fb?.foodConfirmed ?? 0),
      foodDenied: Number(fb?.foodDenied ?? 0),
      answeredKnew,
      discoveries,
      /** null until somebody answers — never show a fake 0%. */
      discoveryRate: answeredKnew > 0 ? discoveries / answeredKnew : null,
      falsePositives: Number(contradictions[0]?.count ?? 0),
      intents: intents.map((i) => ({
        intent: i.intent,
        taps: Number(i.taps),
        empty: Number(i.empty),
      })),
      recent,
    };
  }),
};
