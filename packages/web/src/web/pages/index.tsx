import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Clock,
  Loader2,
  MapPin,
  Pizza,
  Sparkles,
  Sun,
  Trophy,
  Users,
  BookOpenCheck,
} from "lucide-react";
import { Link } from "wouter";
import {
  CampusDot,
  ConfidenceMeter,
  EligibilityChip,
  FoodBadge,
  PaidChip,
  UnconfirmedChip,
} from "../components/chips";
import { EventFeedback } from "../components/event-feedback";
import { Layout } from "../components/layout";
import { clientId } from "../lib/alpha";
import { useDiscover, useToday, type Intent } from "../queries/events";
import { useLogIntent } from "../queries/signals";
import { cn } from "../lib/utils";

type TodayEvent = NonNullable<ReturnType<typeof useToday>["data"]>["events"][number];

const INTENTS: { id: Intent; label: string; icon: typeof Pizza; blurb: string }[] = [
  { id: "food_now", label: "Free food right now", icon: Pizza, blurb: "Food events still to come today" },
  { id: "food_today", label: "Food today", icon: Sun, blurb: "Everything with food, all day" },
  { id: "this_week", label: "Anything this week", icon: Sparkles, blurb: "Next 7 days, ranked" },
  { id: "study", label: "Somewhere to study", icon: BookOpenCheck, blurb: "Academic value 3+" },
  { id: "open_to_all", label: "Open to anyone", icon: Users, blurb: "No school ID needed" },
];

function timeLabel(e: { startsAt: string | null; timeText: string | null }) {
  if (!e.startsAt) return e.timeText ?? "Time TBA";
  return new Date(e.startsAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function EventRow({ e, index }: { e: TodayEvent; index: number }) {
  return (
    <article
      className="card rise flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
    >
      <div className="flex w-24 shrink-0 flex-col">
        <span className="tnum font-display text-xl font-bold">{timeLabel(e)}</span>
        <CampusDot org={e.org} />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="font-display text-lg font-bold leading-snug">{e.title}</h3>
        {e.summary ? <p className="mt-1 text-sm text-ink-soft">{e.summary}</p> : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {e.hasFood && e.foodConfidence >= 0.4 ? (
            <FoodBadge value={e.foodValue} type={e.foodType} />
          ) : (
            <UnconfirmedChip />
          )}
          {e.hasFood ? <ConfidenceMeter value={e.foodConfidence} /> : null}
          <EligibilityChip value={e.eligibility} />
          {!e.isFree ? <PaidChip /> : null}
          {e.registrationRequired ? (
            <span className="chip bg-line/60 text-ink-soft">RSVP needed</span>
          ) : null}
        </div>

        {e.foodEvidence ? (
          <p className="mt-2.5 border-l-2 border-tomato/40 pl-2.5 text-xs italic text-ink-soft">
            “{e.foodEvidence}”
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
          {e.location ? (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {e.location}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {e.timeText ?? "no printed time"}
          </span>
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

        <EventFeedback eventId={e.id} aiSaidFood={e.hasFood} />
      </div>
    </article>
  );
}

function Index() {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [intent, setIntent] = useState<Intent | null>(null);
  const today = useToday(day);
  const discover = useDiscover(intent);
  const logIntent = useLogIntent();
  const logged = useRef<string | null>(null);

  // Log the tap once its result count is known — an empty answer is the signal we most want.
  useEffect(() => {
    if (!intent || !discover.data) return;
    const stamp = `${intent}:${discover.data.count}`;
    if (logged.current === stamp) return;
    logged.current = stamp;
    logIntent.mutate({
      intent,
      resultCount: discover.data.count,
      clientId: clientId(),
    });
  }, [intent, discover.data, logIntent]);

  const data = today.data;
  const usingIntent = intent !== null;
  const events = (usingIntent ? discover.data?.events : data?.events) ?? [];
  const loading = usingIntent ? discover.isLoading : today.isLoading;
  const foodEvents = (data?.events ?? []).filter((e) => e.hasFood);
  const activeIntent = INTENTS.find((i) => i.id === intent);

  return (
    <Layout>
      <div className="grid gap-8 lg:grid-cols-[1.65fr_1fr]">
        <div>
          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-tomato">
              Where should I eat and study today
            </p>
            <h1 className="mt-1.5 font-display text-4xl font-extrabold sm:text-5xl">
              {data ? (
                <>
                  <span className="tnum text-tomato">{data.confirmedMeals}</span> confirmed free
                  {data.confirmedMeals === 1 ? " meal" : " meals"}
                </>
              ) : (
                "Loading today…"
              )}
            </h1>
            <p className="mt-1 text-sm text-ink-soft">
              {data
                ? `${data.events.length} events indexed for this day · ${foodEvents.length} mention food`
                : "Reading the index"}
            </p>
          </div>

          {/* Preset intents, not a search box. Every chip has a defined answer. */}
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {INTENTS.map((i) => {
              const active = intent === i.id;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setIntent(active ? null : i.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition",
                    active
                      ? "border-tomato bg-tomato text-white"
                      : "border-line bg-white text-ink-soft hover:border-tomato/50 hover:text-ink",
                  )}
                >
                  <i.icon className="size-4" />
                  {i.label}
                </button>
              );
            })}
            <input
              type="date"
              value={day}
              onChange={(ev) => {
                setDay(ev.target.value);
                setIntent(null);
              }}
              disabled={usingIntent}
              className="card px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            />
          </div>

          {activeIntent ? (
            <p className="mb-3 text-sm text-ink-soft">
              <strong className="text-ink">{activeIntent.label}</strong> · {activeIntent.blurb} ·{" "}
              <span className="tnum">{discover.data?.count ?? 0}</span> match
              {discover.data?.count === 1 ? "" : "es"} ·{" "}
              <button
                type="button"
                onClick={() => setIntent(null)}
                className="font-semibold text-tomato hover:underline"
              >
                back to the day view
              </button>
            </p>
          ) : null}

          {loading ? (
            <div className="card grid h-48 place-items-center text-ink-soft">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : events.length === 0 ? (
            <div className="card p-8 text-center">
              <h2 className="font-display text-xl font-bold">
                {usingIntent ? "Nothing matches that right now" : "Nothing indexed for this day yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                {usingIntent ? (
                  <>
                    That is a real answer, not a bug — the index genuinely has nothing for this.
                    We logged the empty result so it shows up in the alpha numbers. Know about
                    something?{" "}
                    <Link to="/submit" className="font-semibold text-tomato">
                      Send the flyer
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    Either the scan hasn’t run for {day}, or the calendars genuinely have nothing
                    dated then. Scans run from{" "}
                    <Link to="/admin" className="font-semibold text-tomato">
                      Admin
                    </Link>
                    , and you can always{" "}
                    <Link to="/submit" className="font-semibold text-tomato">
                      paste a flyer
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {events.map((e, i) => (
                <EventRow key={e.id} e={e as TodayEvent} index={i} />
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="bg-ink px-5 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                Best campus today
              </p>
              <p className="font-display text-3xl font-extrabold">{data?.bestCampus?.org ?? "—"}</p>
              <p className="text-sm text-white/70">
                {data?.bestCampus
                  ? `${data.bestCampus.foodEvents} food events · ${data.bestCampus.events} events total`
                  : "No ranked campus for this day"}
              </p>
            </div>
            <div className="divide-y divide-line">
              {(data?.campuses ?? []).map((c) => (
                <div key={c.org} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <CampusDot org={c.org} />
                  <span className="tnum text-ink-soft">
                    <strong className={cn(c.foodEvents > 0 && "text-tomato")}>{c.foodEvents}</strong>{" "}
                    food / {c.events}
                  </span>
                </div>
              ))}
              {(data?.campuses.length ?? 0) === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-soft">Nothing to rank yet.</p>
              ) : null}
            </div>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-ink-soft">
              <Trophy className="size-4 text-ember" />
              Top picks
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {(data?.topPicks ?? []).map((p) => (
                <a
                  key={p.id}
                  href={p.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl border border-line p-3 transition hover:border-tomato/50"
                >
                  <p className="font-semibold leading-snug">{p.title}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {p.org} · score <span className="tnum">{p.score}</span>
                  </p>
                </a>
              ))}
              {(data?.topPicks.length ?? 0) === 0 ? (
                <p className="text-sm text-ink-soft">No picks for this day.</p>
              ) : null}
            </div>
          </div>

          <div className="card p-5 text-sm">
            <p className="font-display text-base font-bold">Two taps help more than you think</p>
            <p className="mt-1.5 text-ink-soft">
              The buttons under each event turn an AI guess into ground truth. If the model claimed
              food and there wasn’t any, saying so is the single most useful thing you can do here.
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              Scanning sources costs money, so it runs from Admin — not from this page.
            </p>
          </div>
        </aside>
      </div>
    </Layout>
  );
}

export default Index;
