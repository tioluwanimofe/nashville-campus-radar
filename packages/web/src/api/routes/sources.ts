import { ORPCError } from "@orpc/server";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";
import { SOURCE_SEEDS } from "../lib/source-seeds";
import { assertAdmin, isAdminKey } from "../lib/admin";
import { runSource } from "../lib/pipeline";

async function ensureSeeded() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.sources);
  if (count > 0) return;
  await db.insert(schema.sources).values(SOURCE_SEEDS).onConflictDoNothing();
}

async function getSource(id: number) {
  const [source] = await db.select().from(schema.sources).where(eq(schema.sources.id, id));
  if (!source) throw new ORPCError("NOT_FOUND", { message: "Source not found" });
  return source;
}

export const sources = {
  list: base.handler(async () => {
    await ensureSeeded();
    return db.select().from(schema.sources).orderBy(schema.sources.org, schema.sources.id);
  }),

  add: base
    .input(
      z.object({
        name: z.string().min(2),
        org: z.string().min(2),
        url: z.string().url(),
        kind: z.enum(["html", "rss", "tribe", "json", "coursedog"]).default("html"),
        adminKey: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      assertAdmin(input.adminKey);
      const [row] = await db
        .insert(schema.sources)
        .values(input)
        .onConflictDoNothing()
        .returning();
      if (!row) throw new ORPCError("CONFLICT", { message: "That URL is already a source" });
      return row;
    }),

  toggle: base
    .input(z.object({ id: z.number(), enabled: z.boolean(), adminKey: z.string() }))
    .handler(async ({ input }) => {
      assertAdmin(input.adminKey);
      await db
        .update(schema.sources)
        .set({ enabled: input.enabled })
        .where(eq(schema.sources.id, input.id));
      return { ok: true };
    }),

  /** Edit name/org/url/kind on an existing source in place, keeping its run history. */
  update: base
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(2),
        org: z.string().min(2),
        url: z.string().url(),
        kind: z.enum(["html", "rss", "tribe", "json", "coursedog"]),
        adminKey: z.string(),
      }),
    )
    .handler(async ({ input }) => {
      assertAdmin(input.adminKey);
      await getSource(input.id); // 404s if missing
      try {
        const [row] = await db
          .update(schema.sources)
          .set({ name: input.name, org: input.org, url: input.url, kind: input.kind })
          .where(eq(schema.sources.id, input.id))
          .returning();
        return row;
      } catch {
        throw new ORPCError("CONFLICT", { message: "That URL is already a source" });
      }
    }),

  remove: base.input(z.object({ id: z.number(), adminKey: z.string() })).handler(async ({ input }) => {
    assertAdmin(input.adminKey);
    await db.delete(schema.events).where(eq(schema.events.sourceId, input.id));
    await db.delete(schema.rawEvents).where(eq(schema.rawEvents.sourceId, input.id));
    await db.delete(schema.runs).where(eq(schema.runs.sourceId, input.id));
    await db.delete(schema.sources).where(eq(schema.sources.id, input.id));
    return { ok: true };
  }),

  /** Scrape + extract one source now. SPENDS AI CREDITS — admin only. */
  run: base.input(z.object({ id: z.number(), adminKey: z.string() })).handler(async ({ input }) => {
    assertAdmin(input.adminKey);
    const source = await getSource(input.id);
    return runSource(source);
  }),

  /**
   * Scrape + extract every enabled source, sequentially so we stay polite to the
   * hosts. This is the single most expensive action in the app (~12-15 AI calls),
   * so it is admin only.
   */
  runAll: base.input(z.object({ adminKey: z.string() })).handler(async ({ input }) => {
    assertAdmin(input.adminKey);
    await ensureSeeded();
    const enabled = await db.select().from(schema.sources).where(eq(schema.sources.enabled, true));
    const results: Array<{ source: string; status: string; events: number; error?: string }> = [];
    for (const source of enabled) {
      const result = await runSource(source);
      results.push({
        source: source.name,
        status: String(result.status ?? "error"),
        events: Number(result.eventCount ?? 0),
        error: result.error ?? undefined,
      });
    }
    return results;
  }),

  /** Free: lets the admin page unlock its controls without spending anything. */
  checkKey: base
    .input(z.object({ adminKey: z.string() }))
    .handler(({ input }) => ({ ok: isAdminKey(input.adminKey) })),

  runs: base.input(z.object({ limit: z.number().default(25) })).handler(async ({ input }) =>
    db
      .select({
        id: schema.runs.id,
        sourceId: schema.runs.sourceId,
        sourceName: schema.sources.name,
        org: schema.sources.org,
        startedAt: schema.runs.startedAt,
        finishedAt: schema.runs.finishedAt,
        status: schema.runs.status,
        httpStatus: schema.runs.httpStatus,
        bytes: schema.runs.bytes,
        candidateCount: schema.runs.candidateCount,
        eventCount: schema.runs.eventCount,
        foodCount: schema.runs.foodCount,
        note: schema.runs.note,
        error: schema.runs.error,
      })
      .from(schema.runs)
      .leftJoin(schema.sources, eq(schema.sources.id, schema.runs.sourceId))
      .orderBy(desc(schema.runs.id))
      .limit(input.limit),
  ),

  /** Raw scraped text behind a run — so you can see exactly what the model read. */
  rawForRun: base
    .input(z.object({ runId: z.number(), limit: z.number().default(10) }))
    .handler(async ({ input }) =>
      db
        .select()
        .from(schema.rawEvents)
        .where(eq(schema.rawEvents.runId, input.runId))
        .limit(input.limit),
    ),
};
