import { ORPCError } from "@orpc/server";
import { desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { base } from "../__core/app";
import { db } from "../database";
import * as schema from "../database/schema";
import { assertAdmin } from "../lib/admin";
import { dedupeKey, parseIso, scoreEvent } from "../lib/pipeline";
import { draftFromPaste } from "../lib/submit-extract";
import { eligibilityValues } from "../lib/extract";

const SUBMISSION_SOURCE = {
  name: "Student submissions",
  org: "Community",
  kind: "user",
  url: "internal://student-submissions",
};

/** The pseudo-source every student-submitted event hangs off, so provenance stays uniform. */
async function ensureSubmissionSource() {
  const [existing] = await db
    .select()
    .from(schema.sources)
    .where(eq(schema.sources.url, SUBMISSION_SOURCE.url));
  if (existing) return existing;
  const [row] = await db
    .insert(schema.sources)
    .values({ ...SUBMISSION_SOURCE, enabled: true })
    .returning();
  return row!;
}

/**
 * Run the one AI call for a queued submission and store the draft on the row.
 * Shared by the single-row and batch admin actions.
 */
async function extractOne(submission: typeof schema.submissions.$inferSelect) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await draftFromPaste({
    text: submission.kind === "url" ? "" : submission.rawInput,
    url: submission.kind === "url" ? submission.rawInput : null,
    today,
    hint: submission.submitterNote ?? null,
  });

  const ok = !result.error && result.draft?.isEvent === true;
  await db
    .update(schema.submissions)
    .set({
      status: ok ? "drafted" : "failed",
      draftJson: result.draft ? JSON.stringify(result.draft) : null,
      fetchedUrl: result.fetchedUrl ?? submission.fetchedUrl ?? null,
      org: result.draft?.org ?? submission.org ?? null,
      extractError: result.error ?? result.draft?.rejectReason ?? null,
    })
    .where(eq(schema.submissions.id, submission.id));

  return {
    submissionId: submission.id,
    status: ok ? "drafted" : "failed",
    draft: result.draft ?? null,
    error: result.error ?? result.draft?.rejectReason ?? null,
  };
}

export const submissions = {
  /**
   * PUBLIC, ZERO AI CALLS. A student pastes a flyer and it lands in the queue
   * exactly as typed. No model runs, no credits move, so this can be open to
   * every tester without a spending ceiling.
   */
  queue: base
    .input(
      z.object({
        text: z.string().default(""),
        url: z.string().url().optional(),
        note: z.string().optional(),
        org: z.string().optional(),
      }),
    )
    .handler(async ({ input }) => {
      const text = input.text.trim();
      if (!text && !input.url) {
        throw new ORPCError("BAD_REQUEST", { message: "Paste some text or give a link." });
      }
      const [row] = await db
        .insert(schema.submissions)
        .values({
          kind: input.url && !text ? "url" : "text",
          rawInput: (input.url && !text ? input.url : text).slice(0, 20_000),
          fetchedUrl: input.url ?? null,
          submitterNote: input.note ?? null,
          org: input.org ?? null,
          status: "queued",
        })
        .returning();
      return { submissionId: row!.id };
    }),

  /**
   * ADMIN, SPENDS CREDITS. One AI call for one queued row.
   */
  extract: base
    .input(z.object({ id: z.number(), adminKey: z.string() }))
    .handler(async ({ input }) => {
      assertAdmin(input.adminKey);
      const [row] = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.id, input.id));
      if (!row) throw new ORPCError("NOT_FOUND", { message: "Submission not found" });
      return extractOne(row);
    }),

  /**
   * ADMIN, SPENDS CREDITS. One AI call per queued row, sequentially, capped so a
   * flood of submissions can never drain the account in one press.
   */
  extractQueued: base
    .input(z.object({ adminKey: z.string(), limit: z.number().min(1).max(25).default(10) }))
    .handler(async ({ input }) => {
      assertAdmin(input.adminKey);
      const rows = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.status, "queued"))
        .orderBy(schema.submissions.id)
        .limit(input.limit);
      const results = [];
      for (const row of rows) results.push(await extractOne(row));
      return { processed: results.length, results };
    }),

  /**
   * The human confirms (and corrects) the draft, and only then does it become a
   * real event. Scored with the same formula as scraped events. Free — no model
   * runs here — but admin-gated because it writes to the public index.
   */
  publish: base
    .input(
      z.object({
        adminKey: z.string(),
        submissionId: z.number(),
        title: z.string().min(3),
        org: z.string().min(2),
        summary: z.string().default(""),
        location: z.string().nullable().default(null),
        startsAtIso: z.string().nullable().default(null),
        timeText: z.string().nullable().default(null),
        sourceUrl: z.string().default(""),
        hasFood: z.boolean(),
        foodType: z.string().nullable().default(null),
        foodEvidence: z.string().nullable().default(null),
        foodConfidence: z.number().min(0).max(1),
        foodValue: z.number().int().min(0).max(4),
        isFree: z.boolean(),
        eligibility: z.enum(eligibilityValues),
        registrationRequired: z.boolean(),
        academicValue: z.number().int().min(0).max(5),
        networkingValue: z.number().int().min(0).max(5),
      }),
    )
    .handler(async ({ input }) => {
      assertAdmin(input.adminKey);
      const [submission] = await db
        .select()
        .from(schema.submissions)
        .where(eq(schema.submissions.id, input.submissionId));
      if (!submission) throw new ORPCError("NOT_FOUND", { message: "Submission not found" });

      const source = await ensureSubmissionSource();
      const startsAt = parseIso(input.startsAtIso);
      const title = input.title.trim();

      const values = {
        sourceId: source.id,
        rawEventId: null,
        dedupeKey: dedupeKey(input.org, title, startsAt),
        title,
        org: input.org,
        summary: input.summary || null,
        location: input.location,
        startsAt,
        endsAt: null,
        timeText: input.timeText,
        sourceUrl: input.sourceUrl || submission.fetchedUrl || SUBMISSION_SOURCE.url,
        hasFood: input.hasFood,
        foodType: input.hasFood ? input.foodType : null,
        foodEvidence: input.hasFood ? input.foodEvidence : null,
        foodConfidence: input.hasFood ? input.foodConfidence : 0,
        foodValue: input.hasFood ? input.foodValue : 0,
        isFree: input.isFree,
        eligibility: input.eligibility,
        registrationRequired: input.registrationRequired,
        academicValue: input.academicValue,
        networkingValue: input.networkingValue,
        score: scoreEvent(input),
        extractedAt: new Date(),
      };

      const [event] = await db
        .insert(schema.events)
        .values(values)
        .onConflictDoUpdate({ target: schema.events.dedupeKey, set: values })
        .returning();

      await db
        .update(schema.submissions)
        .set({ status: "published", eventId: event!.id, org: input.org, extractError: null })
        .where(eq(schema.submissions.id, input.submissionId));

      return event!;
    }),

  /** Free read. Recent tips, so the submit page can show what has actually landed. */
  list: base
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(12),
        status: z.enum(["queued", "drafted", "published", "failed"]).optional(),
      }),
    )
    .handler(({ input }) => {
      const q = db
        .select({
          id: schema.submissions.id,
          kind: schema.submissions.kind,
          org: schema.submissions.org,
          status: schema.submissions.status,
          extractError: schema.submissions.extractError,
          eventId: schema.submissions.eventId,
          fetchedUrl: schema.submissions.fetchedUrl,
          submitterNote: schema.submissions.submitterNote,
          draftJson: schema.submissions.draftJson,
          createdAt: schema.submissions.createdAt,
          rawInput: schema.submissions.rawInput,
          eventTitle: schema.events.title,
          eventStartsAt: schema.events.startsAt,
          eventHasFood: schema.events.hasFood,
        })
        .from(schema.submissions)
        .leftJoin(schema.events, eq(schema.events.id, schema.submissions.eventId))
        .orderBy(desc(schema.submissions.createdAt))
        .limit(input.limit);
      return input.status
        ? q.where(inArray(schema.submissions.status, [input.status]))
        : q;
    }),

  /** Free read. How many pastes are waiting on an AI call. */
  queueCount: base.handler(async () => {
    const rows = await db
      .select({ status: schema.submissions.status })
      .from(schema.submissions);
    return {
      queued: rows.filter((r) => r.status === "queued").length,
      drafted: rows.filter((r) => r.status === "drafted").length,
      published: rows.filter((r) => r.status === "published").length,
      failed: rows.filter((r) => r.status === "failed").length,
    };
  }),

  /** Drop a submission. Published events stay — deleting a tip is not a retraction. */
  remove: base
    .input(z.object({ id: z.number(), adminKey: z.string() }))
    .handler(async ({ input }) => {
      assertAdmin(input.adminKey);
      await db.delete(schema.submissions).where(eq(schema.submissions.id, input.id));
      return { ok: true };
    }),
};
