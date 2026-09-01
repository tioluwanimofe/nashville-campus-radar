import { createGateway } from "ai";
import { generateObject } from "ai";
import { z } from "zod";

export const gateway = createGateway({
  baseURL: process.env.AI_GATEWAY_BASE_URL,
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

const MODEL = "google/gemini-3-flash";

export const eligibilityValues = [
  "public",
  "students_welcome",
  "school_only",
  "invite_only",
  "unknown",
] as const;

const extractedEvent = z.object({
  title: z.string(),
  summary: z.string().describe("One factual sentence, taken from the text. No embellishment."),
  startsAtIso: z
    .string()
    .nullable()
    .describe("ISO 8601 local start datetime, e.g. 2026-08-26T18:00. null if the text has no date."),
  endsAtIso: z.string().nullable(),
  timeText: z.string().nullable().describe("The date/time exactly as printed on the page."),
  location: z.string().nullable(),
  detailUrl: z.string().nullable().describe("Event URL if one is present in the text, else null."),
  hasFood: z.boolean().describe("true only if the text mentions food, drink, or catering."),
  foodType: z.string().nullable().describe("e.g. pizza, BBQ, coffee, ice cream, catered lunch."),
  foodEvidence: z
    .string()
    .nullable()
    .describe("Exact phrase from the text that indicates food. null if there is none."),
  foodConfidence: z.number().min(0).max(1).describe("0 = no food signal, 1 = explicitly stated."),
  foodValue: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("0 none, 1 drinks only, 2 snacks, 3 light meal, 4 full meal."),
  isFree: z.boolean().describe("true unless a ticket price or cost is stated."),
  eligibility: z.enum(eligibilityValues),
  registrationRequired: z.boolean(),
  academicValue: z.number().int().min(0).max(5),
  networkingValue: z.number().int().min(0).max(5),
});

export type ExtractedEvent = z.infer<typeof extractedEvent>;

const schema = z.object({ events: z.array(extractedEvent) });

const RULES = `You are an information EXTRACTOR for a Nashville campus event radar. You never invent facts.

Hard rules:
- Only report events that actually appear in the supplied text. If the text is navigation, menus, or boilerplate, return an empty list.
- hasFood may be true ONLY when the text mentions food, drink, catering, or a food-named event (pizza party, BBQ, ice cream social, coffee hour, luncheon, reception with refreshments, cookout, donuts, tailgate meal).
- foodEvidence must be a verbatim quote from the text. If you cannot quote it, hasFood is false, foodConfidence <= 0.3.
- A title that implies food ("FDOC Pizza Party", "Welcome Back BBQ") counts as evidence: quote the title and use foodConfidence around 0.6-0.75.
- Never guess a date. If no date appears, startsAtIso is null.
- eligibility: "public" = anyone may attend; "students_welcome" = open to college students generally; "school_only" = restricted to that school's community; "invite_only" = registration/invitation restricted; "unknown" if the text does not say.
- isFree is false when any admission cost or ticket price is stated.
- Deduplicate repeated listings of the same event within the text.`;

type ExtractArgs = {
  text: string;
  org: string;
  sourceUrl: string;
  today: string;
  mode: "items" | "listing";
};

/** Runs the LLM extraction pass over one blob of scraped text. Returns [] on model failure. */
export async function extractEvents({
  text,
  org,
  sourceUrl,
  today,
  mode,
}: ExtractArgs): Promise<{ events: ExtractedEvent[]; error?: string }> {
  const framing =
    mode === "items"
      ? `The text below contains one or more pre-parsed event records from a calendar feed, separated by "-----". Convert each real event into one output item.`
      : `The text below is raw text scraped from an event listing page. Find every event in it. Ignore navigation, menus, footers, and unrelated page furniture.`;

  try {
    const { object } = await generateObject({
      model: gateway(MODEL),
      schema,
      system: RULES,
      prompt: `${framing}

Organization / campus: ${org}
Source page: ${sourceUrl}
Today's date: ${today} (America/Chicago). Assume years for bare dates so the event is the next upcoming occurrence.

TEXT:
"""
${text}
"""`,
    });
    return { events: object.events };
  } catch (err) {
    return { events: [], error: err instanceof Error ? err.message : String(err) };
  }
}
