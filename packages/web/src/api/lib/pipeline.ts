import { eq } from "drizzle-orm";
import { db } from "../database";
import * as schema from "../database/schema";
import { absoluteUrl, fetchPage } from "./fetcher";
import { type Candidate, parseHtmlChunks, parseJsonLd, parseRss, parseTribe } from "./parsers";
import { type ExtractedEvent, extractEvents } from "./extract";

const MAX_FEED_ITEMS = 60;
const ITEMS_PER_LLM_CALL = 12;

type Source = typeof schema.sources.$inferSelect;

/** Ranking used by the Today view: food first, then how usable the event actually is. */
export function scoreEvent(e: {
  hasFood: boolean;
  foodValue: number;
  foodConfidence: number;
  isFree: boolean;
  eligibility: string;
  academicValue: number;
  networkingValue: number;
}): number {
  const eligibilityWeight =
    e.eligibility === "public" || e.eligibility === "students_welcome"
      ? 1
      : e.eligibility === "unknown"
        ? 0.75
        : e.eligibility === "school_only"
          ? 0.5
          : 0.2;
  const food = e.hasFood ? e.foodValue * 10 * e.foodConfidence : 0;
  const value = e.academicValue * 1.5 + e.networkingValue * 1.5;
  return Math.round((food + value) * eligibilityWeight * (e.isFree ? 1 : 0.55) * 10) / 10;
}

export function dedupeKey(org: string, title: string, startsAt: Date | null): string {
  const day = startsAt ? startsAt.toISOString().slice(0, 10) : "nodate";
  return `${org}|${title.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 90)}|${day}`;
}

export function parseIso(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value.length <= 16 ? `${value}:00` : value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildCandidates(source: Source, body: string): { candidates: Candidate[]; mode: "items" | "listing"; note: string } {
  if (source.kind === "rss") {
    const candidates = parseRss(body, MAX_FEED_ITEMS);
    return { candidates, mode: "items", note: `RSS feed: ${candidates.length} items parsed` };
  }
  if (source.kind === "tribe") {
    const candidates = parseTribe(body, MAX_FEED_ITEMS);
    return { candidates, mode: "items", note: `WordPress events API: ${candidates.length} records` };
  }
  const jsonLd = parseJsonLd(body, source.url, MAX_FEED_ITEMS);
  if (jsonLd.length > 0) {
    return {
      candidates: jsonLd,
      mode: "items",
      note: `schema.org JSON-LD: ${jsonLd.length} event objects`,
    };
  }
  const chunks = parseHtmlChunks(body, source.url);
  return {
    candidates: chunks,
    mode: "listing",
    note: `no structured data — ${chunks.length} text chunk(s) sent to the model`,
  };
}

/** Scrape one source, run the AI extraction pass, and store the results. Never throws. */
export async function runSource(source: Source) {
  const startedAt = new Date();
  const [run] = await db
    .insert(schema.runs)
    .values({ sourceId: source.id, startedAt, status: "running" })
    .returning();
  const runId = run!.id;

  const finish = async (patch: Partial<typeof schema.runs.$inferInsert>) => {
    await db
      .update(schema.runs)
      .set({ finishedAt: new Date(), ...patch })
      .where(eq(schema.runs.id, runId));
    await db
      .update(schema.sources)
      .set({
        lastRunAt: new Date(),
        lastStatus: (patch.status as string) ?? "error",
        lastError: patch.error ?? null,
        lastCandidateCount: patch.candidateCount ?? 0,
        lastEventCount: patch.eventCount ?? 0,
      })
      .where(eq(schema.sources.id, source.id));
    return { runId, ...patch };
  };

  const page = await fetchPage(source.url);
  if (!page.ok || page.bytes < 200) {
    return finish({
      status: "error",
      httpStatus: page.status,
      bytes: page.bytes,
      error:
        page.error ??
        `source returned HTTP ${page.status} (${page.bytes} bytes) — it likely blocks automated requests`,
    });
  }

  const { candidates, mode, note } = buildCandidates(source, page.body);
  if (candidates.length === 0) {
    return finish({
      status: "partial",
      httpStatus: page.status,
      bytes: page.bytes,
      note,
      error: "fetched fine, but nothing event-shaped could be parsed out of the response",
    });
  }

  const fetchedAt = new Date();
  const rawIds: number[] = [];
  for (const c of candidates) {
    const [row] = await db
      .insert(schema.rawEvents)
      .values({
        sourceId: source.id,
        runId,
        title: c.title,
        rawText: c.rawText,
        detailUrl: c.detailUrl,
        fetchedAt,
      })
      .returning();
    rawIds.push(row!.id);
  }

  const today = new Date().toISOString().slice(0, 10);
  let stored = 0;
  let foodCount = 0;
  const errors: string[] = [];

  const batches: Array<{ text: string; ids: number[]; urls: Array<string | null> }> = [];
  if (mode === "items") {
    for (let i = 0; i < candidates.length; i += ITEMS_PER_LLM_CALL) {
      const slice = candidates.slice(i, i + ITEMS_PER_LLM_CALL);
      batches.push({
        text: slice.map((c) => `${c.rawText}\nURL: ${c.detailUrl ?? source.url}`).join("\n-----\n"),
        ids: rawIds.slice(i, i + ITEMS_PER_LLM_CALL),
        urls: slice.map((c) => c.detailUrl),
      });
    }
  } else {
    candidates.forEach((c, i) => {
      batches.push({ text: c.rawText, ids: [rawIds[i]!], urls: [c.detailUrl] });
    });
  }

  for (const batch of batches) {
    const { events: extracted, error } = await extractEvents({
      text: batch.text,
      org: source.org,
      sourceUrl: source.url,
      today,
      mode,
    });
    if (error) {
      errors.push(error);
      continue;
    }
    for (const e of extracted) {
      const startsAt = parseIso(e.startsAtIso);
      const ok = await storeEvent(source, batch.ids[0] ?? null, e, startsAt);
      if (ok) {
        stored += 1;
        if (e.hasFood) foodCount += 1;
      }
    }
    await db
      .update(schema.rawEvents)
      .set({ extracted: true })
      .where(eq(schema.rawEvents.runId, runId));
  }

  return finish({
    status: errors.length > 0 && stored === 0 ? "error" : errors.length > 0 ? "partial" : "ok",
    httpStatus: page.status,
    bytes: page.bytes,
    candidateCount: candidates.length,
    eventCount: stored,
    foodCount,
    note,
    error: errors.length > 0 ? `model errors: ${errors.slice(0, 2).join(" | ")}` : null,
  });
}

async function storeEvent(
  source: Source,
  rawEventId: number | null,
  e: ExtractedEvent,
  startsAt: Date | null,
): Promise<boolean> {
  const title = e.title.trim();
  if (title.length < 3) return false;
  const values = {
    sourceId: source.id,
    rawEventId,
    dedupeKey: dedupeKey(source.org, title, startsAt),
    title,
    org: source.org,
    summary: e.summary,
    location: e.location,
    startsAt,
    endsAt: parseIso(e.endsAtIso),
    timeText: e.timeText,
    sourceUrl: absoluteUrl(e.detailUrl, source.url),
    hasFood: e.hasFood,
    foodType: e.foodType,
    foodEvidence: e.foodEvidence,
    foodConfidence: e.hasFood ? e.foodConfidence : 0,
    foodValue: e.hasFood ? e.foodValue : 0,
    isFree: e.isFree,
    eligibility: e.eligibility,
    registrationRequired: e.registrationRequired,
    academicValue: e.academicValue,
    networkingValue: e.networkingValue,
    score: scoreEvent(e),
    extractedAt: new Date(),
  };

  await db
    .insert(schema.events)
    .values(values)
    .onConflictDoUpdate({ target: schema.events.dedupeKey, set: values });
  return true;
}
