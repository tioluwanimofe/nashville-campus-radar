import { useEffect, useState } from "react";
import {
  Check,
  CircleDollarSign,
  Compass,
  Filter,
  PlusCircle,
  Quote,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { Layout } from "../components/layout";
import { cn } from "../lib/utils";
import { useStats } from "../queries/events";

/* ------------------------------------------------------------------ */
/* Section registry — drives both the TOC and the scroll-spy           */
/* ------------------------------------------------------------------ */

const SECTIONS = [
  { id: "start", label: "Start here", icon: Sparkles },
  { id: "trust", label: "Why trust it", icon: ShieldCheck },
  { id: "today", label: "Today", icon: Radar },
  { id: "feed", label: "Feed", icon: Filter },
  { id: "add", label: "Add an event", icon: PlusCircle },
  { id: "playbook", label: "Playbook", icon: Compass },
];

/* ------------------------------------------------------------------ */
/* Small presentational helpers                                        */
/* ------------------------------------------------------------------ */

function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  lead?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-line pt-12 first:border-0 first:pt-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tomato">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-[2.1rem]">{title}</h2>
      {lead && <p className="mt-3 max-w-[62ch] text-[1.02rem] text-ink-soft">{lead}</p>}
      <div className="mt-6 space-y-5">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[68ch] text-[0.99rem] leading-[1.75]">{children}</p>;
}

function Callout({
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
        <h3 className="font-display text-[1.05rem] font-bold">{title}</h3>
      </div>
      <div className="mt-2 space-y-2 text-[0.95rem] leading-relaxed text-ink-soft [&_strong]:text-ink">
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

const BADGES: { chip: string; cls: string; meaning: string }[] = [
  {
    chip: "Full meal / Snacks / Drinks",
    cls: "bg-tomato-soft text-tomato",
    meaning:
      "Food confirmed, with type and specifics pulled from the source — “lunch”, “ice cream”, “coffee”.",
  },
  {
    chip: "Food not confirmed",
    cls: "bg-line/70 text-ink-soft",
    meaning:
      "The source text never mentioned food. Not proof there is none — proof nobody wrote it down.",
  },
  {
    chip: "72%",
    cls: "bg-ember-soft text-ember",
    meaning: "Confidence: how explicit the wording was. Low numbers quietly demote the event.",
  },
  {
    chip: "Students welcome",
    cls: "bg-basil-soft text-basil",
    meaning: "Who can actually walk in. Also: Public, That school only, Invite only.",
  },
  {
    chip: "Costs money",
    cls: "bg-berry-soft text-berry",
    meaning: "Not free. Ranks well below the free stuff.",
  },
  {
    chip: "RSVP needed",
    cls: "bg-line/70 text-ink-soft",
    meaning: "Registration required — check the original page before you show up.",
  },
];

const DO_THIS = [
  "Check it the night before. The date picker on Today moves the whole page, so you can plan tomorrow from bed.",
  "Live in Feed when Today looks thin. Events cluster around certain weeks, so a single day can be quiet even when the month is busy.",
  "Trust the evidence quote over the badge. The badge is a summary; the quote is the fact.",
  "Open “View original” before you walk across campus. One click, and you see the real event page.",
  "Paste flyers you see into Add event. It costs you fifteen seconds and it is the fastest way this gets better.",
];

const NOT_THIS = [
  "Don’t read “Food not confirmed” as “no food.” Most events with pizza never say pizza on the calendar page.",
  "Don’t treat 100% confidence as a guarantee. It means the source text was unambiguous, not that the food shows up.",
  "Don’t show up to a “That school only” event at a campus that isn’t yours.",
  "Don’t assume an empty day means nothing is happening — it usually means nobody published it where the app can read it.",
];

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function ManualPage() {
  const [active, setActive] = useState(SECTIONS[0].id);
  const stats = useStats();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );

    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <Layout>
      {/* Hero */}
      <header className="rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tomato">
          User manual
        </p>
        <h1 className="mt-2 max-w-[20ch] font-display text-[2.7rem] font-extrabold leading-[1.02] sm:text-[3.4rem]">
          How to actually
          <span className="text-tomato"> eat free</span> in Nashville
        </h1>
        <p className="mt-4 max-w-[64ch] text-[1.05rem] text-ink-soft">
          Campus Radar has one job: tell you where to get a free meal and a decent place to study
          today, and never lie to you about it. Three pages do the work — Today decides for you,
          Feed lets you plan the week, Add event lets you put a flyer you saw into the system.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { k: stats.data ? String(stats.data.events) : "—", v: "events indexed", c: "text-ink" },
            {
              k: stats.data ? String(stats.data.confirmed) : "—",
              v: "with confirmed food",
              c: "text-tomato",
            },
            {
              k: stats.data
                ? `${stats.data.sources.healthy}/${stats.data.sources.total}`
                : "—",
              v: "sources healthy",
              c: "text-basil",
            },
          ].map((s) => (
            <div key={s.v} className="card px-5 py-4">
              <p className={cn("tnum font-display text-3xl font-extrabold", s.c)}>{s.k}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{s.v}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-card border border-ember/35 bg-ember-soft p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-[18px] text-ember" />
            <h3 className="font-display text-[1.05rem] font-bold">The one thing to internalize</h3>
          </div>
          <p className="mt-2 max-w-[70ch] text-[0.95rem] leading-relaxed text-ink-soft">
            The app only knows what it has read. An empty Today page almost never means “no free
            food in Nashville” — it means “nothing was published for that date where the app could
            find it.” That is also why{" "}
            <strong className="text-ink">Add event</strong> exists: a flyer on a wall is invisible
            to the app until somebody types it in.
          </p>
        </div>
      </header>

      {/* Body: TOC + content */}
      <div className="mt-12 flex flex-col gap-10 lg:flex-row lg:gap-12">
        <aside className="lg:w-[218px] lg:shrink-0">
          <nav className="lg:sticky lg:top-24">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              Contents
            </p>
            <ul className="flex flex-wrap gap-1 lg:flex-col lg:gap-0.5">
              {SECTIONS.map((s) => {
                const on = active === s.id;
                return (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition",
                        on
                          ? "bg-tomato-soft text-tomato"
                          : "text-ink-soft hover:bg-line/60 hover:text-ink",
                      )}
                    >
                      <s.icon className="size-4 shrink-0" />
                      {s.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-12">
          {/* 1 — Start here */}
          <Section
            id="start"
            eyebrow="Start here"
            title="Three pages, three jobs"
            lead="If you read nothing else, read this."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Radar,
                  name: "Today",
                  body: "Ranked answer to “where do I eat and study today.” Opens by default.",
                },
                {
                  icon: Filter,
                  name: "Feed",
                  body: "Everything indexed, with real filters. Where you plan the week.",
                },
                {
                  icon: PlusCircle,
                  name: "Add event",
                  body: "Paste a flyer, a group text, an Instagram caption. Takes seconds.",
                },
              ].map((c) => (
                <div key={c.name} className="card p-5">
                  <c.icon className="size-5 text-tomato" />
                  <h3 className="mt-3 font-display text-lg font-bold">{c.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{c.body}</p>
                </div>
              ))}
            </div>
            <Callout tone="good" icon={CircleDollarSign} title="Nothing here costs you anything">
              <p>
                Browsing, filtering, pasting a flyer, answering the two feedback buttons — all free,
                no account, no sign-up. There is nothing on this site you can accidentally get
                billed for.
              </p>
            </Callout>
          </Section>

          {/* 2 — Why trust it */}
          <Section
            id="trust"
            eyebrow="Trust"
            title="How “free food” gets confirmed"
            lead="The rule the whole app is built on: it reports what a source said, and shows you the words."
          >
            <P>
              Campus Radar reads public campus event pages and the flyers people paste in. When it
              says an event has food, it is because <strong>the source text said so</strong> — and
              it keeps the sentence that said it. That sentence sits right under the event, in
              italics. You can always check the app’s work.
            </P>
            <P>
              Nothing is ever guessed into existence. If no wording mentions food, the event is
              marked <strong>“Food not confirmed”</strong> instead of quietly being called a meal.
              Every claim also carries a <strong>confidence percentage</strong>: how explicit the
              wording was. “Free pizza provided” scores high. “Join us for a reception” scores low.
            </P>
            <Callout tone="bad" icon={Quote} title="Read the quote, not just the badge">
              <p>
                If the italic quote is just the event title repeated back, treat the food claim as{" "}
                <strong>weak</strong> — the wording was suggestive, not specific. If it is a real
                sentence from the description (“lunch will be served”), it is solid. This one habit
                will make you better at using the site than any filter.
              </p>
            </Callout>
            <P>
              Events are also checked by a human before anything pasted by a student shows up
              publicly. That is why your submission does not appear the instant you send it.
            </P>
          </Section>

          {/* 3 — Today */}
          <Section
            id="today"
            eyebrow="Page one"
            title="Today — the decision page"
            lead="Read it top to bottom. It is built to be acted on in about fifteen seconds."
          >
            <P>
              <strong>The hero number</strong> counts confirmed free meals for the selected date.
              The line under it (“8 events found for this day · 1 mention food”) is the honest
              denominator. A big gap between the two is normal and expected, not a bug.
            </P>
            <P>
              <strong>The chips</strong> — Food now, Food today, This week, Study spot, Open to all
              — are one-tap questions. Tap the one that matches what you actually need and the list
              re-ranks around it. <strong>The date picker</strong> moves the whole page, so use it
              the night before to plan tomorrow.
            </P>

            <div className="card overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <h3 className="font-display text-[1.05rem] font-bold">Reading the badge strip</h3>
              </div>
              <ul className="divide-y divide-line">
                {BADGES.map((b) => (
                  <li key={b.chip} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
                    <span className="sm:w-[190px] sm:shrink-0">
                      <span className={cn("chip", b.cls)}>{b.chip}</span>
                    </span>
                    <span className="text-sm leading-relaxed text-ink-soft">{b.meaning}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Callout tone="warn" icon={ShieldCheck} title="Two questions under each event">
              <p>
                <strong>“Did you go?”</strong> and <strong>“Was there food?”</strong> Answering
                takes one tap and it is the only way anyone finds out whether a food claim was
                right. If you got there and there was nothing, say so — a wrong claim caught is
                worth more than a compliment.
              </p>
            </Callout>

            <P>
              The <strong>sidebar</strong> gives you Best campus today (highest food density), the
              campus ranking, and Top picks — the three highest-scoring events, if you would rather
              not read the whole list.
            </P>
          </Section>

          {/* 4 — Feed */}
          <Section
            id="feed"
            eyebrow="Page two"
            title="Feed — planning the week"
            lead="Same data, no date restriction, and filters that actually matter."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { n: "Food mentioned", d: "The single most useful toggle. Collapses everything to events with food evidence." },
                { n: "Free only", d: "Drops paid events." },
                { n: "All campuses", d: "Narrow to your school, or to non-campus sources." },
                { n: "Any eligibility", d: "Set to Public or Students welcome when going somewhere that isn’t your campus." },
                { n: "Min food confidence", d: "The quality dial. 0 shows everything; ~60% shows only claims worth acting on." },
              ].map((f) => (
                <div key={f.n} className="card p-4">
                  <p className="font-display text-[1rem] font-bold">{f.n}</p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">{f.d}</p>
                </div>
              ))}
            </div>

            <Callout tone="good" icon={Search} title="The workflow that works">
              <p>
                <strong>Food mentioned + Free only + confidence ≥ 60%</strong> gives you the “I will
                actually eat this week” shortlist. Then drop confidence to 0 and skim the greys for
                titles that smell like food — “Welcome Back Social”, “Info Session”, anything with
                “Reception”. Those are the misses worth one click through to the original page.
              </p>
            </Callout>
          </Section>

          {/* 5 — Add an event */}
          <Section
            id="add"
            eyebrow="Page three"
            title="Add event — the part that needs you"
            lead="Most free food in Nashville is advertised on paper, in group chats, and in Instagram stories. None of that is on a calendar the app can read."
          >
            <P>
              Open <strong>Add event</strong>, paste whatever you have — the whole flyer text, the
              group-chat message, the caption — and send it. You do not need to format it, clean it
              up, or fill in fields. Messy is fine; it gets read word for word.
            </P>
            <P>
              Include the <strong>date, time, place, and any sentence that mentions food</strong> if
              they are in the original. That last one matters most: the exact wording is what
              becomes the evidence quote other students see.
            </P>
            <Callout tone="neutral" icon={PlusCircle} title="What happens after you send">
              <p>
                Your paste is stored exactly as you typed it and waits for review. It goes public
                only after a human checks it against what you pasted. That delay is deliberate — it
                is the reason nothing on this site is made up.
              </p>
            </Callout>
          </Section>

          {/* 6 — Playbook */}
          <Section
            id="playbook"
            eyebrow="Getting the most out of it"
            title="The playbook"
            lead="Five things to do, four things not to."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <Check className="size-[18px] text-basil" />
                  <h3 className="font-display text-[1.05rem] font-bold">Do this</h3>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {DO_THIS.map((t) => (
                    <li key={t} className="flex gap-2.5 text-[0.93rem] leading-relaxed text-ink-soft">
                      <Check className="mt-1 size-3.5 shrink-0 text-basil" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-2">
                  <X className="size-[18px] text-tomato" />
                  <h3 className="font-display text-[1.05rem] font-bold">Not this</h3>
                </div>
                <ul className="mt-3 space-y-2.5">
                  {NOT_THIS.map((t) => (
                    <li key={t} className="flex gap-2.5 text-[0.93rem] leading-relaxed text-ink-soft">
                      <X className="mt-1 size-3.5 shrink-0 text-tomato" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <Callout tone="neutral" icon={Compass} title="What this app can’t see">
              <p>
                Some campuses publish events in a way no automated reader can pick up, and
                Instagram and Discord — where a lot of the real free-food chatter lives — are closed
                off entirely. So coverage is uneven by campus, and always will be until people paste
                things in. If your school looks thin here, that is the gap you can personally close.
              </p>
            </Callout>
          </Section>
        </div>
      </div>
    </Layout>
  );
}
