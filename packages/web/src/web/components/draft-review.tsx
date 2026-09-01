import { useState } from "react";
import { BadgeCheck, Check, Loader2, Quote, Send, TriangleAlert, Utensils } from "lucide-react";
import { ConfidenceMeter } from "./chips";
import { usePublishSubmission } from "../queries/submissions";
import { cn } from "../lib/utils";

const ORGS = ["Vanderbilt", "Belmont", "Lipscomb", "Trevecca", "TSU", "Fisk", "Community"];

/**
 * The model returns the host as written ("Trevecca SGA", "Vanderbilt AMA"), which
 * is more specific than our campus list. Match on the campus inside it instead of
 * silently dumping everything into "Community".
 */
export function matchOrg(raw: string): string {
  const v = (raw ?? "").toLowerCase();
  const hit = ORGS.find((o) => v.includes(o.toLowerCase()));
  if (hit) return hit;
  if (v.includes("tennessee state")) return "TSU";
  if (v.includes("vandy")) return "Vanderbilt";
  return "Community";
}

const ELIGIBILITY = [
  { value: "public", label: "Anyone can come" },
  { value: "students_welcome", label: "Any college student" },
  { value: "school_only", label: "That school only" },
  { value: "invite_only", label: "Invite / registration only" },
  { value: "unknown", label: "Doesn’t say" },
];

const inputCls =
  "w-full rounded-xl border border-line bg-bg/50 px-3 py-2 text-sm outline-none transition focus:border-tomato/60 focus:bg-white";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

/** The shape stored in submissions.draftJson by the extraction step. */
export type RawDraft = {
  isEvent?: boolean;
  rejectReason?: string | null;
  title?: string;
  org?: string;
  summary?: string;
  location?: string | null;
  startsAtIso?: string | null;
  timeText?: string | null;
  hasFood?: boolean;
  foodType?: string | null;
  foodEvidence?: string | null;
  foodConfidence?: number;
  foodValue?: number;
  isFree?: boolean;
  eligibility?: string;
  registrationRequired?: boolean;
  academicValue?: number;
  networkingValue?: number;
  missing?: string[];
};

type Editable = {
  title: string;
  org: string;
  summary: string;
  location: string;
  startsAtIso: string;
  timeText: string;
  sourceUrl: string;
  hasFood: boolean;
  foodType: string;
  foodEvidence: string;
  foodConfidence: number;
  foodValue: number;
  isFree: boolean;
  eligibility: string;
  registrationRequired: boolean;
  academicValue: number;
  networkingValue: number;
};

function toEditable(d: RawDraft, fallbackUrl: string): Editable {
  return {
    title: d.title ?? "",
    org: matchOrg(d.org ?? ""),
    summary: d.summary ?? "",
    location: d.location ?? "",
    startsAtIso: d.startsAtIso ?? "",
    timeText: d.timeText ?? "",
    sourceUrl: fallbackUrl ?? "",
    hasFood: d.hasFood ?? false,
    foodType: d.foodType ?? "",
    foodEvidence: d.foodEvidence ?? "",
    foodConfidence: d.foodConfidence ?? 0,
    foodValue: d.foodValue ?? 0,
    isFree: d.isFree ?? true,
    eligibility: d.eligibility ?? "unknown",
    registrationRequired: d.registrationRequired ?? false,
    academicValue: d.academicValue ?? 0,
    networkingValue: d.networkingValue ?? 0,
  };
}

/**
 * Human-in-the-loop gate. Nothing an AI produced reaches the public index without
 * somebody reading it here first, and any edit made here beats the model.
 */
export function DraftReview({
  submissionId,
  raw,
  fallbackUrl,
  adminKey,
  onPublished,
}: {
  submissionId: number;
  raw: RawDraft;
  fallbackUrl: string;
  adminKey: string;
  onPublished?: (title: string) => void;
}) {
  const [draft, setDraft] = useState<Editable>(() => toEditable(raw, fallbackUrl));
  const [done, setDone] = useState<string | null>(null);
  const doPublish = usePublishSubmission();
  const missing = raw.missing ?? [];

  async function publish() {
    const event = await doPublish.mutateAsync({
      adminKey,
      submissionId,
      title: draft.title,
      org: draft.org,
      summary: draft.summary,
      location: draft.location || null,
      startsAtIso: draft.startsAtIso || null,
      timeText: draft.timeText || null,
      sourceUrl: draft.sourceUrl,
      hasFood: draft.hasFood,
      foodType: draft.foodType || null,
      foodEvidence: draft.foodEvidence || null,
      foodConfidence: draft.foodConfidence,
      foodValue: draft.foodValue,
      isFree: draft.isFree,
      eligibility: draft.eligibility as "public",
      registrationRequired: draft.registrationRequired,
      academicValue: draft.academicValue,
      networkingValue: draft.networkingValue,
    });
    setDone(event.title);
    onPublished?.(event.title);
  }

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-xl bg-basil-soft p-3 text-sm text-basil">
        <Check className="size-4 shrink-0" />
        <span>
          <strong>“{done}”</strong> is live in Today and Feed.
        </span>
      </p>
    );
  }

  return (
    <div className="rounded-card border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <span className="grid size-9 place-items-center rounded-xl bg-ember-soft text-ember">
          <BadgeCheck className="size-5" />
        </span>
        <div>
          <h3 className="font-display text-base font-bold">Check it before it goes live</h3>
          <p className="text-xs text-ink-soft">
            Everything below came out of the student’s text. Your edit wins over the model.
          </p>
        </div>
      </div>

      {missing.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-ember-soft p-3 text-sm text-ink-soft">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ember" />
          <span>
            Not in the paste, so left blank:{" "}
            <strong className="text-ink">{missing.join(", ")}</strong>
          </span>
        </p>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Title">
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Campus / host">
          <select
            value={draft.org}
            onChange={(e) => setDraft({ ...draft, org: e.target.value })}
            className={inputCls}
          >
            {ORGS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who can come">
          <select
            value={draft.eligibility}
            onChange={(e) => setDraft({ ...draft, eligibility: e.target.value })}
            className={inputCls}
          >
            {ELIGIBILITY.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts (local)">
          <input
            type="datetime-local"
            value={draft.startsAtIso.slice(0, 16)}
            onChange={(e) => setDraft({ ...draft, startsAtIso: e.target.value })}
            className={inputCls}
          />
        </Field>
        <Field label="Location">
          <input
            value={draft.location}
            onChange={(e) => setDraft({ ...draft, location: e.target.value })}
            placeholder="Building, room, lawn…"
            className={inputCls}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="One-line summary">
            <input
              value={draft.summary}
              onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Link (optional — where it was seen)">
            <input
              value={draft.sourceUrl}
              onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
              placeholder="https://…"
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      <div className="mt-4 rounded-card border border-line bg-bg/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Utensils className="size-4 text-tomato" />
            <h4 className="font-display text-[1rem] font-bold">Food</h4>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.hasFood}
              onChange={(e) => setDraft({ ...draft, hasFood: e.target.checked })}
              className="size-4 accent-tomato"
            />
            There’s food
          </label>
        </div>

        {draft.foodEvidence && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-sm text-ink-soft">
            <Quote className="mt-0.5 size-4 shrink-0 text-ember" />
            <span>
              Quoted from the paste: <strong className="text-ink">“{draft.foodEvidence}”</strong>
            </span>
          </p>
        )}

        {draft.hasFood && (
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field label="What kind">
              <input
                value={draft.foodType}
                onChange={(e) => setDraft({ ...draft, foodType: e.target.value })}
                placeholder="pizza, BBQ, coffee…"
                className={inputCls}
              />
            </Field>
            <Field
              label={`How much — ${["none", "drinks", "snacks", "light meal", "full meal"][draft.foodValue] ?? "none"}`}
            >
              <input
                type="range"
                min={0}
                max={4}
                value={draft.foodValue}
                onChange={(e) => setDraft({ ...draft, foodValue: Number(e.target.value) })}
                className="w-full accent-tomato"
              />
            </Field>
            <div>
              <span className={labelCls}>Model confidence</span>
              <ConfidenceMeter value={draft.foodConfidence} />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={publish}
          disabled={doPublish.isPending || draft.title.trim().length < 3}
          className={cn(
            "inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white transition disabled:opacity-40",
          )}
        >
          {doPublish.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          Publish to the radar
        </button>
        {doPublish.isError && (
          <span className="text-sm text-tomato">{doPublish.error.message}</span>
        )}
      </div>
    </div>
  );
}
