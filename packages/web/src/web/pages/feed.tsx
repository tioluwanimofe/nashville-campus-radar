import { useState } from "react";
import { ArrowUpRight, Loader2, MapPin } from "lucide-react";
import {
  CampusDot,
  ConfidenceMeter,
  EligibilityChip,
  FoodBadge,
  PaidChip,
  UnconfirmedChip,
} from "../components/chips";
import { Layout } from "../components/layout";
import { type FeedFilters, useFeed, useStats } from "../queries/events";
import { cn } from "../lib/utils";

const ELIGIBILITY_OPTIONS = [
  { value: "", label: "Any eligibility" },
  { value: "public", label: "Open to public" },
  { value: "students_welcome", label: "Students welcome" },
  { value: "school_only", label: "School only" },
  { value: "invite_only", label: "Invite / registration" },
  { value: "unknown", label: "Unclear" },
];

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
        active
          ? "border-tomato bg-tomato text-white"
          : "border-line bg-surface text-ink-soft hover:border-tomato/40",
      )}
    >
      {children}
    </button>
  );
}

function FeedPage() {
  const stats = useStats();
  const [filters, setFilters] = useState<FeedFilters>({
    foodOnly: true,
    freeOnly: true,
    minConfidence: 0,
  });
  const feed = useFeed(filters);
  const rows = feed.data ?? [];

  return (
    <Layout>
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-tomato">
          Everything the radar has
        </p>
        <h1 className="mt-1.5 font-display text-4xl font-extrabold">Upcoming feed</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {feed.isLoading ? "Loading…" : `${rows.length} events match your filters`}
        </p>
      </div>

      <div className="card mb-6 flex flex-wrap items-center gap-2.5 p-4">
        <Toggle
          active={filters.foodOnly}
          onClick={() => setFilters((f) => ({ ...f, foodOnly: !f.foodOnly }))}
        >
          Food mentioned
        </Toggle>
        <Toggle
          active={filters.freeOnly}
          onClick={() => setFilters((f) => ({ ...f, freeOnly: !f.freeOnly }))}
        >
          Free only
        </Toggle>

        <select
          value={filters.org ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, org: e.target.value || undefined }))}
          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold"
        >
          <option value="">All campuses</option>
          {(stats.data?.orgs ?? []).map((o) => (
            <option key={o.org} value={o.org}>
              {o.org} ({o.count})
            </option>
          ))}
        </select>

        <select
          value={filters.eligibility ?? ""}
          onChange={(e) => setFilters((f) => ({ ...f, eligibility: e.target.value || undefined }))}
          className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold"
        >
          {ELIGIBILITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label className="ml-auto flex items-center gap-2.5 text-sm font-semibold text-ink-soft">
          Min food confidence
          <input
            type="range"
            min={0}
            max={0.9}
            step={0.1}
            value={filters.minConfidence}
            onChange={(e) => setFilters((f) => ({ ...f, minConfidence: Number(e.target.value) }))}
            className="accent-tomato"
          />
          <span className="tnum w-9 text-ink">{Math.round(filters.minConfidence * 100)}%</span>
        </label>
      </div>

      {feed.isLoading ? (
        <div className="card grid h-48 place-items-center text-ink-soft">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink-soft">
          No indexed events match this combination. Loosen the filters, or run a scan from Sources.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((e, i) => (
            <article
              key={e.id}
              className="card rise flex flex-col gap-2 p-4"
              style={{ animationDelay: `${Math.min(i, 14) * 35}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-bold leading-snug">{e.title}</h3>
                <CampusDot org={e.org} />
              </div>
              <p className="tnum text-sm font-semibold text-ink-soft">
                {e.startsAt
                  ? new Date(e.startsAt).toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : (e.timeText ?? "Date not printed")}
              </p>
              {e.summary ? <p className="text-sm text-ink-soft">{e.summary}</p> : null}
              <div className="flex flex-wrap items-center gap-2">
                {e.hasFood && e.foodConfidence >= 0.4 ? (
                  <FoodBadge value={e.foodValue} type={e.foodType} />
                ) : (
                  <UnconfirmedChip />
                )}
                {e.hasFood ? <ConfidenceMeter value={e.foodConfidence} /> : null}
                <EligibilityChip value={e.eligibility} />
                {!e.isFree ? <PaidChip /> : null}
              </div>
              {e.foodEvidence ? (
                <p className="border-l-2 border-tomato/40 pl-2.5 text-xs italic text-ink-soft">
                  “{e.foodEvidence}”
                </p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs text-ink-soft">
                {e.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {e.location}
                  </span>
                ) : null}
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-tomato hover:underline"
                >
                  View original
                  <ArrowUpRight className="size-3.5" />
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </Layout>
  );
}

export default FeedPage;
