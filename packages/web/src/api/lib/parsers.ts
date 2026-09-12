import { absoluteUrl, decodeEntities, htmlToText } from "./fetcher";
import { extractNuxtState } from "./nuxt-literal";

export type Candidate = {
  title: string | null;
  rawText: string;
  detailUrl: string | null;
};

function tag(block: string, name: string): string | null {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(block);
  if (!m?.[1]) return null;
  return decodeEntities(m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** RSS / Atom feeds (LiveWhale, WordPress, Localist all expose one). */
export function parseRss(xml: string, limit: number): Candidate[] {
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [];
  const out: Candidate[] = [];
  for (const block of blocks) {
    const title = tag(block, "title");
    if (!title) continue;
    const link = tag(block, "link") ?? tag(block, "guid");
    const description = tag(block, "description") ?? tag(block, "summary") ?? "";
    const pubDate = tag(block, "pubDate") ?? tag(block, "updated") ?? "";
    const start = /<livewhale:date_time>([\s\S]*?)<\/livewhale:date_time>/i.exec(block)?.[1] ?? "";
    const allDay = /<livewhale:all_day>1<\/livewhale:all_day>/i.test(block);
    const categories = (block.match(/<livewhale:categories>([\s\S]*?)<\/livewhale:categories>/i)?.[1] ?? "").trim();
    const location = tag(block, "livewhale:location") ?? "";
    out.push({
      title,
      detailUrl: link,
      rawText: [
        `TITLE: ${title}`,
        pubDate && `DATE: ${pubDate}`,
        start && `TIME: ${start}`,
        allDay && "ALL_DAY: yes",
        location && `LOCATION: ${location}`,
        categories && `CATEGORIES: ${categories}`,
        description && `DESCRIPTION: ${description.slice(0, 900)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
    if (out.length >= limit) break;
  }
  return out;
}

type TribeEvent = {
  title?: string;
  url?: string;
  description?: string;
  excerpt?: string;
  start_date?: string;
  end_date?: string;
  cost?: string;
  venue?: { venue?: string };
};

/** The Events Calendar (WordPress) REST API. */
export function parseTribe(json: string, limit: number): Candidate[] {
  let parsed: { events?: TribeEvent[] };
  try {
    parsed = JSON.parse(json) as { events?: TribeEvent[] };
  } catch {
    return [];
  }
  return (parsed.events ?? []).slice(0, limit).map((e) => ({
    title: e.title ?? null,
    detailUrl: e.url ?? null,
    rawText: [
      `TITLE: ${e.title ?? ""}`,
      e.start_date && `START: ${e.start_date}`,
      e.end_date && `END: ${e.end_date}`,
      e.venue?.venue && `LOCATION: ${e.venue.venue}`,
      e.cost && `COST: ${e.cost}`,
      `DESCRIPTION: ${htmlToText(e.description ?? e.excerpt ?? "", 900)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}

type JsonLdNode = {
  "@type"?: string | string[];
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: { name?: string; address?: unknown } | string;
  offers?: { price?: string | number; url?: string } | Array<{ price?: string | number }>;
  "@graph"?: JsonLdNode[];
  itemListElement?: Array<{ item?: JsonLdNode }>;
};

function isEventNode(node: JsonLdNode): boolean {
  const t = node["@type"];
  const types = Array.isArray(t) ? t : [t];
  return types.some((x) => typeof x === "string" && x.toLowerCase().includes("event"));
}

function flatten(node: JsonLdNode, acc: JsonLdNode[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) flatten(n, acc);
    return;
  }
  if (isEventNode(node)) acc.push(node);
  for (const g of node["@graph"] ?? []) flatten(g, acc);
  for (const li of node.itemListElement ?? []) if (li?.item) flatten(li.item, acc);
}

/** schema.org Event objects embedded in the page — the highest-quality HTML signal. */
export function parseJsonLd(html: string, baseUrl: string, limit: number): Candidate[] {
  const scripts = html.match(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  const nodes: JsonLdNode[] = [];
  for (const s of scripts) {
    const body = s.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      flatten(JSON.parse(body) as JsonLdNode, nodes);
    } catch {
      /* malformed block — skip it, the text pass still runs */
    }
  }
  return nodes.slice(0, limit).map((n) => {
    const price = Array.isArray(n.offers) ? n.offers[0]?.price : n.offers?.price;
    const location = typeof n.location === "string" ? n.location : n.location?.name;
    return {
      title: n.name ?? null,
      detailUrl: absoluteUrl(n.url, baseUrl),
      rawText: [
        `TITLE: ${n.name ?? ""}`,
        n.startDate && `START: ${n.startDate}`,
        n.endDate && `END: ${n.endDate}`,
        location && `LOCATION: ${location}`,
        price !== undefined && `PRICE: ${String(price)}`,
        n.description && `DESCRIPTION: ${htmlToText(n.description, 900)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  });
}

type TrumbaEvent = {
  title?: string;
  description?: string;
  location?: string;
  locationType?: string;
  startDateTime?: string;
  endDateTime?: string;
  dateTimeFormatted?: string;
  canceled?: boolean;
  permaLinkUrl?: string;
  eventActionUrl?: string;
  categoryCalendar?: string;
};

/** Trumba's public JSON feed (`trumba.com/calendars/<name>.json`) — used by Belmont. */
export function parseTrumbaJson(json: string, limit: number): Candidate[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }
  const events = Array.isArray(parsed) ? (parsed as TrumbaEvent[]) : [];
  return events
    .filter((e) => !e.canceled && e.title)
    .slice(0, limit)
    .map((e) => ({
      title: e.title ? decodeEntities(e.title) : null,
      detailUrl: e.permaLinkUrl ?? null,
      rawText: [
        `TITLE: ${decodeEntities(e.title ?? "")}`,
        e.dateTimeFormatted && `DATE: ${decodeEntities(e.dateTimeFormatted)}`,
        e.startDateTime && `START: ${e.startDateTime}`,
        e.endDateTime && `END: ${e.endDateTime}`,
        e.location && `LOCATION: ${e.location}${e.locationType ? ` (${e.locationType})` : ""}`,
        e.categoryCalendar && `CATEGORY: ${e.categoryCalendar}`,
        e.description && `DESCRIPTION: ${htmlToText(decodeEntities(e.description), 900)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    }));
}

type CoursedogMeeting = {
  startDate?: string;
  startTime?: number;
  endDate?: string;
  endTime?: number;
  eventData?: {
    name?: string;
    type?: string;
    description?: string;
    status?: string;
    organization?: string;
    contacts?: Array<{ name?: string; email?: string }>;
  };
};

function fmtClock(t: number | undefined): string | null {
  if (t === undefined || t === null) return null;
  const h = Math.floor(t / 100);
  const m = t % 100;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Coursedog's embedded events calendar (`*.events.prod.coursedog.com/upcoming`) — used by
 * Trevecca. The page is server-rendered with the data baked into a `window.__NUXT__` blob
 * instead of exposing a real JSON endpoint, so we parse that (see nuxt-literal.ts) and walk
 * `state.meetings.calendar`, a year -> month -> day -> meetingId tree.
 */
export function parseCoursedogNuxt(html: string, limit: number): Candidate[] {
  let state: unknown;
  try {
    state = extractNuxtState(html);
  } catch {
    return [];
  }
  const calendar = (state as { state?: { meetings?: { calendar?: unknown } } })?.state?.meetings?.calendar;
  if (!calendar || typeof calendar !== "object") return [];

  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const yearNode of Object.values(calendar as Record<string, unknown>)) {
    if (!yearNode || typeof yearNode !== "object") continue;
    for (const monthNode of Object.values(yearNode as Record<string, unknown>)) {
      if (!monthNode || typeof monthNode !== "object") continue;
      for (const dayNode of Object.values(monthNode as Record<string, unknown>)) {
        if (!dayNode || typeof dayNode !== "object") continue;
        for (const meeting of Object.values(dayNode as Record<string, CoursedogMeeting>)) {
          const ev = meeting?.eventData;
          if (!ev?.name || ev.status === "Canceled") continue;
          // The same recurring event appears once per day it meets — keep every instance,
          // but skip exact duplicate (name + start) rows the feed sometimes repeats.
          const dedupe = `${ev.name}|${meeting.startDate}|${meeting.startTime}`;
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          const contact = ev.contacts?.[0];
          out.push({
            title: ev.name,
            detailUrl: null,
            rawText: [
              `TITLE: ${ev.name}`,
              meeting.startDate && `DATE: ${meeting.startDate}`,
              `TIME: ${fmtClock(meeting.startTime) ?? "?"} - ${fmtClock(meeting.endTime) ?? "?"}`,
              ev.type && `TYPE: ${ev.type}`,
              contact?.name && `CONTACT: ${contact.name}${contact.email ? ` <${contact.email}>` : ""}`,
              ev.description && `DESCRIPTION: ${htmlToText(ev.description, 900)}`,
            ]
              .filter(Boolean)
              .join("\n"),
          });
          if (out.length >= limit) return out;
        }
      }
    }
  }
  return out;
}

/**
 * Fallback for calendars that only render in HTML: hand the cleaned page text to the model
 * in chunks and let it segment the listing. Chunks overlap so an event split across a
 * boundary still lands whole in one chunk.
 */
export function parseHtmlChunks(html: string, baseUrl: string, chunkChars = 6000, maxChunks = 3): Candidate[] {
  const text = htmlToText(html, chunkChars * maxChunks + 2000);
  const chunks: Candidate[] = [];
  for (let i = 0, n = 0; i < text.length && n < maxChunks; i += chunkChars - 400, n++) {
    const slice = text.slice(i, i + chunkChars).trim();
    if (slice.length < 200) break;
    chunks.push({ title: null, rawText: slice, detailUrl: baseUrl });
  }
  return chunks;
}
