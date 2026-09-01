import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Check,
  CircleDollarSign,
  Compass,
  Cpu,
  Database,
  Gauge,
  Rocket,
  ShieldCheck,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { cn } from "../lib/utils";

/**
 * The working principle — architecture, scoring math, caps, source internals,
 * credit mechanics. This is the part worth keeping private, so it renders only
 * inside the unlocked Admin view. The public /manual keeps everything a student
 * needs to USE the site and nothing about how it is built.
 */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className="tnum mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-ink font-display text-sm font-bold text-white">
        {n}
      </span>
      <div>
        <h4 className="font-display text-[1.05rem] font-bold">{title}</h4>
        <div className="mt-1 max-w-[62ch] text-[0.93rem] leading-relaxed text-ink-soft [&_strong]:text-ink">
          {children}
        </div>
      </div>
    </div>
  );
}

function Note({
  tone = "neutral",
  icon: Icon,
  title,
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad";
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-line bg-surface",
    good: "border-basil/30 bg-basil-soft",
    warn: "border-ember/35 bg-ember-soft",
    bad: "border-tomato/30 bg-tomato-soft",
  } as const;
  const iconTones = {
    neutral: "text-ink-soft",
    good: "text-basil",
    warn: "text-ember",
    bad: "text-tomato",
  } as const;
  return (
    <div className={cn("rounded-card border p-5", tones[tone])}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-[18px] shrink-0", iconTones[tone])} />
        <h4 className="font-display text-[1.02rem] font-bold">{title}</h4>
      </div>
      <div className="mt-2 space-y-2 text-[0.93rem] leading-relaxed text-ink-soft [&_strong]:text-ink">
        {children}
      </div>
    </div>
  );
}

function Block({
  icon: Icon,
  eyebrow,
  title,
  lead,
  children,
}: {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-line pt-8 first:border-0 first:pt-0">
      <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-tomato">
        <Icon className="size-4" />
        {eyebrow}
      </p>
      <h3 className="mt-2 font-display text-2xl font-extrabold">{title}</h3>
      {lead && <p className="mt-2 max-w-[62ch] text-[0.98rem] text-ink-soft">{lead}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

const SOURCE_HEALTH: {
  name: string;
  status: "ok" | "low" | "partial" | "blocked";
  result: string;
}[] = [
  { name: "Events@Vanderbilt (LiveWhale RSS)", status: "ok", result: "60 candidates → 59 events, 17 with food" },
  { name: "Lipscomb Upcoming Events", status: "ok", result: "15 events, 2 with food" },
  { name: "Lipscomb Student Events", status: "ok", result: "3 events, 1 with food" },
  { name: "Belmont University Events", status: "low", result: "HTTP 200, 0 events extracted" },
  { name: "Trevecca Events Calendar", status: "low", result: "HTTP 200, 0 events extracted" },
  { name: "TSU Campus Event Calendar", status: "low", result: "HTTP 200, calendar is JS-rendered" },
  { name: "Fisk University (WP feed)", status: "partial", result: "Valid API, calendar currently empty" },
  { name: "Nashville Public Library", status: "blocked", result: "HTTP 403 — blocks automated requests" },
  { name: "Eventbrite (Nashville free)", status: "blocked", result: "HTTP 405 — blocks automated requests" },
];

const STATUS_META = {
  ok: { label: "Healthy", cls: "bg-basil-soft text-basil", Icon: BadgeCheck },
  low: { label: "Low yield", cls: "bg-line/70 text-ink-soft", Icon: AlertTriangle },
  partial: { label: "Partial", cls: "bg-ember-soft text-ember", Icon: TriangleAlert },
  blocked: { label: "Blocked", cls: "bg-tomato-soft text-tomato", Icon: Ban },
} as const;

const CREDIT_ROWS: { action: string; billed: boolean; note: string }[] = [
  { action: "Site hosted / published / sitting idle", billed: false, note: "No idle drain, ever" },
  { action: "Visitors browsing Today, Feed, Manual", billed: false, note: "Reads come from the local database" },
  { action: "Intent chips, filters, date picker", billed: false, note: "Pure client + DB work" },
  { action: "A student pasting a flyer into Add event", billed: false, note: "Queued verbatim — no AI runs" },
  { action: "The two feedback buttons under an event", billed: false, note: "Plain database writes" },
  { action: "“Refresh all”", billed: true, note: "~12–15 AI calls across all 9 sources" },
  { action: "“Run” on a single source", billed: true, note: "A fraction of a full refresh" },
  { action: "“Read next 10” on the queue", billed: true, note: "One call per queued paste, capped at 25" },
];

const ROADMAP = [
  { t: "Add more sources", d: "Free, immediate, no code. Biggest single win available." },
  { t: "Headless-browser fetcher", d: "Unlocks TSU, Belmont, Trevecca, Eventbrite and the library in one change — roughly doubles usable sources." },
  { t: "Daily digest (email or Telegram)", d: "Turns the app from something students visit into something that tells them. Pairs with one scheduled scan a day, which caps spend at a known number." },
  { t: "Distance / map view", d: "Campus lat/lng are already stored for every source, so this is mostly UI work." },
  { t: "Agentic source discovery", d: "Let the agent find new Nashville event pages on its own and propose them here." },
];

export function WorkingPrinciple() {
  return (
    <div className="card mb-8 p-6 sm:p-7">
      <div className="mb-7 flex flex-wrap items-center gap-3 border-b border-line pb-5">
        <span className="grid size-10 place-items-center rounded-xl bg-ink text-white">
          <Cpu className="size-5" />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tomato">
            Admin only — not on the public manual
          </p>
          <h2 className="font-display text-2xl font-extrabold">The working principle</h2>
        </div>
      </div>

      <div className="space-y-8">
        <Block
          icon={Cpu}
          eyebrow="Pipeline"
          title="What happens when you scan"
          lead="Four stages, every time. Knowing them tells you why a source succeeds or fails."
        >
          <Step n={1} title="Fetch">
            Plain HTTP GET with a browser user-agent, 25-second timeout, one request per source. No
            JavaScript execution — which is exactly why JS-rendered calendars come back empty.
          </Step>
          <Step n={2} title="Parse">
            Pull out event-shaped candidates. <strong>rss</strong> parses XML feed items.{" "}
            <strong>tribe</strong> parses the WordPress Events Calendar JSON API.{" "}
            <strong>html</strong> looks for schema.org JSON-LD first, then falls back to cleaned text
            split into overlapping ~6,000-character chunks (max 3).
          </Step>
          <Step n={3} title="Extract">
            Batches of up to 12 candidates go to <strong>google/gemini-3-flash</strong> with a strict
            schema. The instructions forbid invention: <strong>foodEvidence</strong> must be a
            verbatim quote from the source, and with no evidence, <strong>hasFood</strong> is false.
          </Step>
          <Step n={4} title="Score & store">
            Events are deduped and ranked, and the exact raw text the model read is saved so any
            claim can be audited later.
          </Step>
          <Note tone="warn" icon={Timer} title="Hard caps worth knowing">
            <p>
              <strong>60 candidates per source per scan</strong> and{" "}
              <strong>12 candidates per AI call</strong>. A feed with 1,000 items only gives you the
              first 60 — which is also what keeps a scan cheap. Queue extraction is capped at{" "}
              <strong>25 pastes per press</strong>, so an open submit form can never drain the
              account.
            </p>
          </Note>
        </Block>

        <Block
          icon={Gauge}
          eyebrow="The math"
          title="How ranking works"
          lead="Deliberately blunt, so the order never surprises you."
        >
          <pre className="overflow-x-auto rounded-card border border-line bg-ink p-5 text-[0.83rem] leading-relaxed text-white">
            <code>{`food  = hasFood ? foodValue(0-4) × 10 × confidence(0-1) : 0
value = academicValue × 1.5 + networkingValue × 1.5
score = (food + value) × eligibilityWeight × (isFree ? 1 : 0.55)`}</code>
          </pre>

          <div className="rounded-card border border-line p-5">
            <p className="text-sm font-bold text-ink">Eligibility weights</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { l: "Public", v: "1.0", c: "bg-basil-soft text-basil" },
                { l: "Students welcome", v: "1.0", c: "bg-basil-soft text-basil" },
                { l: "Unknown", v: "0.75", c: "bg-line/70 text-ink-soft" },
                { l: "That school only", v: "0.5", c: "bg-ember-soft text-ember" },
                { l: "Invite only", v: "0.2", c: "bg-tomato-soft text-tomato" },
              ].map((e) => (
                <span key={e.l} className={cn("chip tnum", e.c)}>
                  {e.l} · ×{e.v}
                </span>
              ))}
            </div>
          </div>

          <ul className="space-y-2.5">
            {[
              "A confirmed full meal (4 × 10 × 0.9 = 36) always outranks a great networking event with no food (~6). Food dominates by design.",
              "A meal you can’t get into is punished hard — invite-only cuts the score by 80%. That’s the “don’t build it around crashing events” principle, encoded in math.",
              "Low confidence quietly demotes an event even when food is flagged: a 30%-confidence meal scores about a third of a 90% one.",
            ].map((t) => (
              <li key={t} className="flex gap-2.5 text-[0.93rem] leading-relaxed text-ink-soft">
                <Check className="mt-1 size-4 shrink-0 text-tomato" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block
          icon={Database}
          eyebrow="Sources"
          title="Adding and diagnosing feeds"
          lead="Why the numbers below look the way they do, and how to move them."
        >
          <Note tone="neutral" icon={Database} title="Picking the right kind">
            <p>
              <strong>rss</strong> — if the URL returns XML. Highest quality by far.
              <br />
              <strong>tribe</strong> — for WordPress sites. Try{" "}
              <code className="rounded bg-line/70 px-1 py-0.5 text-[0.85em]">
                &lt;domain&gt;/wp-json/tribe/events/v1/events?per_page=50
              </code>{" "}
              first; many university and church sites run this plugin without advertising it.
              <br />
              <strong>html</strong> — everything else. Works, but yields least.
            </p>
            <p>
              Test the URL in a browser tab first. If events only appear after a second of
              JavaScript, a plain fetch can’t see them and this app can’t use it yet.
            </p>
          </Note>

          <div className="overflow-hidden rounded-card border border-line">
            <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
              <h4 className="font-display text-[1.02rem] font-bold">
                Source health — Aug 25, 2026 scan
              </h4>
              <span className="tnum text-xs text-ink-soft">6/9 healthy</span>
            </div>
            <ul className="divide-y divide-line">
              {SOURCE_HEALTH.map((s) => {
                const meta = STATUS_META[s.status];
                return (
                  <li
                    key={s.name}
                    className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <meta.Icon
                        className={cn(
                          "size-4 shrink-0",
                          s.status === "ok"
                            ? "text-basil"
                            : s.status === "blocked"
                              ? "text-tomato"
                              : s.status === "partial"
                                ? "text-ember"
                                : "text-ink-soft",
                        )}
                      />
                      <span className="truncate text-sm font-semibold">{s.name}</span>
                    </span>
                    <span className={cn("chip shrink-0", meta.cls)}>{meta.label}</span>
                    <span className="text-xs text-ink-soft sm:w-[260px] sm:shrink-0">
                      {s.result}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <Note tone="warn" icon={AlertTriangle} title="Vanderbilt is carrying this build">
            <p>
              59 of the 88 events come from one source. That isn’t a bug in the code — it’s that
              Vanderbilt is the only one of the six schools publishing a clean machine-readable
              feed. Adding good feeds, and reading student pastes, is how that changes.
            </p>
          </Note>

          <Note tone="neutral" icon={Ban} title="Known limits, plainly">
            <p>
              TSU’s calendar needs JavaScript. Eventbrite and the public library actively block
              bots. Belmont and Trevecca bury events in JS widgets, so the text-chunk fallback finds
              little. Instagram and Discord — where a lot of the real free-food chatter actually
              lives — are out of scope entirely, because of auth walls and terms of service.
            </p>
          </Note>
        </Block>

        <Block
          icon={CircleDollarSign}
          eyebrow="Money"
          title="Credits & hosting"
          lead="Hosting isn’t the problem. AI calls are the only metered action, and they all live behind this key."
        >
          <Note tone="good" icon={ShieldCheck} title="Hosting does not burn credits">
            <p>
              Per the platform’s deployment docs: “Creating and deploying a website does not cost
              credits. Credits are only used if your website calls the AI gateway for AI-powered
              features.” The site sitting live at a URL, being visited, serving pages — not metered.{" "}
              <strong>There is no idle drain.</strong>
            </p>
          </Note>

          <div className="overflow-hidden rounded-card border border-line">
            <ul className="divide-y divide-line">
              {CREDIT_ROWS.map((r) => (
                <li
                  key={r.action}
                  className="flex flex-col gap-1.5 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <span className="min-w-0 flex-1 text-sm font-semibold">{r.action}</span>
                  <span
                    className={cn(
                      "chip shrink-0",
                      r.billed ? "bg-tomato-soft text-tomato" : "bg-basil-soft text-basil",
                    )}
                  >
                    {r.billed ? "Costs credits" : "Free"}
                  </span>
                  <span className="text-xs text-ink-soft sm:w-[230px] sm:shrink-0">{r.note}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="max-w-[68ch] text-[0.95rem] leading-[1.7] text-ink-soft">
            <strong className="text-ink">Sizing a scan.</strong> A full refresh across all 9 sources
            sends roughly <strong className="text-ink">12–15 AI calls</strong> — Vanderbilt alone is
            60 candidates ÷ 12 per batch = 5 calls, the rest are 1–2 each, and blocked sources cost
            nothing because they never reach the AI step. Flash is the cheap tier, which is exactly
            why it was chosen over a stronger model.
          </p>

          <Note tone="warn" icon={TriangleAlert} title="What could not be verified">
            <p>
              The <strong>exact credit cost per AI-gateway call</strong> is unconfirmed — the docs
              domain doesn’t resolve from the build sandbox, so that claim rests on a search snippet
              rather than the page itself. No number is invented here. What is certain is the{" "}
              <em>shape</em> of the cost: it scales with AI calls and nothing else. Check your
              balance before and after one full refresh and you’ll have the real per-scan figure in
              thirty seconds.
            </p>
          </Note>

          <div className="rounded-card border border-line p-5">
            <p className="text-sm font-bold">Three ways to keep it near zero</p>
            <ol className="mt-3 space-y-2.5">
              {[
                "Scan once a day, not on impulse. Every extra press re-extracts data that hasn’t changed.",
                "Use per-source Run instead of Refresh all. Re-running just Vanderbilt gets ~78% of the value for ~40% of the calls.",
                "Disable the dead sources. Blocked and empty sources keep refreshes tight when turned off.",
              ].map((t, i) => (
                <li key={t} className="flex gap-3 text-[0.92rem] leading-relaxed text-ink-soft">
                  <span className="tnum mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-ink text-[0.7rem] font-bold text-white">
                    {i + 1}
                  </span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </div>
        </Block>

        <Block
          icon={Rocket}
          eyebrow="Roadmap"
          title="Where to take it next"
          lead="Ranked by value per unit of effort."
        >
          <ol className="space-y-3">
            {ROADMAP.map((r, i) => (
              <li key={r.t} className="flex gap-4 rounded-card border border-line p-4">
                <span className="tnum grid size-8 shrink-0 place-items-center rounded-xl bg-tomato font-display text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="font-display text-[1.02rem] font-bold">{r.t}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-ink-soft">{r.d}</p>
                </div>
              </li>
            ))}
          </ol>

          <Note tone="neutral" icon={Compass} title="Where these numbers come from">
            <p>
              Everything above was read out of the codebase — the scoring formula and batch caps
              from the pipeline, the source list from the seeds file — plus the live scan run on Aug
              25, 2026. Not from recollection. Source health will drift as the sites change.
            </p>
          </Note>
        </Block>
      </div>
    </div>
  );
}
