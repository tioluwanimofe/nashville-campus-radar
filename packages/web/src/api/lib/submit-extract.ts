import { generateObject } from "ai";
import { z } from "zod";
import { fetchPage, htmlToText } from "./fetcher";
import { eligibilityValues, gateway } from "./extract";

const MODEL = "google/gemini-3-flash";

/**
 * Single-event extraction for a human-supplied tip. Same hard rule as the
 * scraper: the model EXTRACTS, it never invents. foodEvidence must be a
 * verbatim quote from what the student pasted, or hasFood is false.
 */
const drafted = z.object({
  isEvent: z
    .boolean()
    .describe("false when the text is not an event at all (random text, a login page, spam)."),
  rejectReason: z
    .string()
    .nullable()
    .describe("If isEvent is false, one plain sentence explaining why."),
  title: z.string(),
  org: z
    .string()
    .describe(
      "Campus or organization hosting it: Vanderbilt, Belmont, Lipscomb, Trevecca, TSU, Fisk, or the group's name. 'Unknown' if the text does not say.",
    ),
  summary: z.string().describe("One factual sentence taken from the text. No embellishment."),
  startsAtIso: z
    .string()
    .nullable()
    .describe("ISO 8601 local start, e.g. 2026-08-26T18:00. null if the text has no date."),
  endsAtIso: z.string().nullable(),
  timeText: z.string().nullable().describe("The date/time exactly as written in the text."),
  location: z.string().nullable(),
  hasFood: z.boolean().describe("true only if the text mentions food, drink, or catering."),
  foodType: z.string().nullable(),
  foodEvidence: z
    .string()
    .nullable()
    .describe("Exact phrase from the text indicating food. null if there is none."),
  foodConfidence: z.number().min(0).max(1),
  foodValue: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("0 none, 1 drinks only, 2 snacks, 3 light meal, 4 full meal."),
  isFree: z.boolean(),
  eligibility: z.enum(eligibilityValues),
  registrationRequired: z.boolean(),
  academicValue: z.number().int().min(0).max(5),
  networkingValue: z.number().int().min(0).max(5),
  missing: z
    .array(z.string())
    .describe("Fields a human still needs to fill in, e.g. ['date', 'location']."),
});

export type DraftedEvent = z.infer<typeof drafted>;

const RULES = `You are an information EXTRACTOR for a Nashville campus event radar. A student has pasted a tip: a flyer's text, a screenshot caption, an Instagram post, or the text of an event page. Turn it into one event record.

Hard rules:
- Extract only what the text says. Never invent a date, a location, or food.
- hasFood may be true ONLY when the text mentions food, drink, catering, or is a food-named event (pizza party, BBQ, ice cream social, coffee hour, luncheon, cookout, donuts, free lunch).
- foodEvidence must be a verbatim quote from the pasted text. If you cannot quote it, hasFood is false and foodConfidence <= 0.3.
- A title that implies food ("Welcome Back BBQ") counts as evidence: quote it and use foodConfidence 0.6-0.75.
- Never guess a year or a date. If no date appears, startsAtIso is null and add "date" to missing.
- eligibility: "public" = anyone; "students_welcome" = college students generally; "school_only" = that school's community only; "invite_only" = restricted; "unknown" if unstated.
- isFree is false only when a cost or ticket price is stated.
- If the text is clearly not an event, set isEvent false and explain in rejectReason instead of inventing one.
- List every field a human still needs to supply in "missing".`;

type DraftArgs = { text: string; url?: string | null; today: string; hint?: string | null };

/** Turns a pasted blob (or a fetched URL) into one draft event. Never throws. */
export async function draftFromPaste({ text, url, today, hint }: DraftArgs): Promise<{
  draft?: DraftedEvent;
  sourceText: string;
  fetchedUrl?: string | null;
  error?: string;
}> {
  let sourceText = text.trim();
  let fetchedUrl: string | null = null;

  if (url) {
    const page = await fetchPage(url);
    if (!page.ok || !page.body) {
      return {
        sourceText,
        error: `Could not read that link (${page.status ?? "no response"}). Paste the text from the page instead — extraction works exactly the same on pasted text.`,
      };
    }
    fetchedUrl = url;
    const pageText = htmlToText(page.body, 12_000);
    sourceText = sourceText ? `${sourceText}\n\n---\n\n${pageText}` : pageText;
  }

  if (sourceText.length < 12) {
    return { sourceText, error: "That is too short to extract anything from." };
  }

  try {
    const { object } = await generateObject({
      model: gateway(MODEL),
      schema: drafted,
      system: RULES,
      prompt: `Today's date: ${today} (America/Chicago). Assume years for bare dates so the event is the next upcoming occurrence.
${hint ? `The student added this note: "${hint}"\n` : ""}${fetchedUrl ? `This text came from: ${fetchedUrl}\n` : ""}
PASTED TEXT:
"""
${sourceText.slice(0, 14_000)}
"""`,
    });
    return { draft: object, sourceText, fetchedUrl };
  } catch (err) {
    return {
      sourceText,
      fetchedUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
