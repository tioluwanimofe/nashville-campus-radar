import { useState } from "react";
import {
  Check,
  Clipboard,
  Clock3,
  Link2,
  Loader2,
  Send,
  ShieldCheck,
  TriangleAlert,
  Utensils,
} from "lucide-react";
import { Layout } from "../components/layout";
import { useQueueCount, useQueueSubmission, useRecentSubmissions } from "../queries/submissions";
import { cn } from "../lib/utils";

const ORGS = ["Vanderbilt", "Belmont", "Lipscomb", "Trevecca", "TSU", "Fisk", "Community"];

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

/**
 * PUBLIC SUBMIT — deliberately zero AI calls.
 *
 * The paste is stored exactly as typed and waits in a queue. An admin spends the
 * one AI call that reads it, reviews the draft, and publishes. That keeps every
 * credit under one person's control while leaving submission open to everybody,
 * which is the input this alpha actually needs.
 */
function SubmitPage() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [org, setOrg] = useState("");
  const [sent, setSent] = useState(false);

  const queue = useQueueSubmission();
  const counts = useQueueCount();
  const recent = useRecentSubmissions(10);

  const canSend = text.trim().length > 11 || /^https?:\/\/\S+$/.test(url.trim());

  async function send() {
    await queue.mutateAsync({
      text,
      url: url.trim() ? url.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
      org: org || undefined,
    });
    setSent(true);
    setText("");
    setUrl("");
    setNote("");
    setOrg("");
  }

  return (
    <Layout>
      <header className="rise">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tomato">
          Add an event
        </p>
        <h1 className="mt-2 max-w-[24ch] font-display text-[2.3rem] font-extrabold leading-[1.05] sm:text-[2.9rem]">
          Saw free food somewhere? Paste it here.
        </h1>
        <p className="mt-3 max-w-[68ch] text-[1.02rem] text-ink-soft">
          Three campuses publish calendars the scraper can’t read — Belmont, Trevecca and TSU all
          return a page with no events in it. A flyer’s text, an Instagram caption, or a link fixes
          that in ten seconds. Paste it raw; you don’t have to format anything.
        </p>
        <p className="mt-3 flex max-w-[68ch] items-start gap-2 rounded-xl border border-line bg-white p-3 text-sm text-ink-soft">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-basil" />
          <span>
            <strong className="text-ink">This costs nothing and reads nothing.</strong> Your paste
            is stored word for word — no AI runs when you press send. An admin spends the single AI
            call that turns it into a listing, then checks it before it goes live.
          </span>
        </p>
      </header>

      <section className="card mt-6 p-5 sm:p-6">
        <Field label="Paste the flyer text, caption, or post">
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSent(false);
            }}
            rows={6}
            placeholder={
              "e.g. FREE PIZZA + game night — Trevecca SGA\nThursday Aug 27, 7pm, Boone Business Building lobby\nOpen to all students, no RSVP"
            }
            className={cn(inputCls, "resize-y font-mono text-[13px] leading-relaxed")}
          />
        </Field>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="Or a link (optional)">
            <div className="flex items-center gap-2">
              <Link2 className="size-4 shrink-0 text-ink-soft" />
              <input
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setSent(false);
                }}
                placeholder="https://…"
                className={inputCls}
              />
            </div>
          </Field>
          <Field label="Which campus (optional)">
            <select value={org} onChange={(e) => setOrg(e.target.value)} className={inputCls}>
              <option value="">Not sure</option>
              {ORGS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Anything the text doesn’t say (optional)">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. basement, food runs out fast"
              className={inputCls}
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!canSend || queue.isPending}
            onClick={send}
            className="inline-flex items-center gap-2 rounded-full bg-tomato px-5 py-2.5 text-sm font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {queue.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {queue.isPending ? "Sending…" : "Send it in"}
          </button>
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
            <Clock3 className="size-3.5" />
            {counts.data
              ? `${counts.data.queued} waiting to be read · ${counts.data.published} published so far`
              : "No AI, no credits, no waiting on us to approve your account."}
          </span>
        </div>

        {queue.isError && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-tomato-soft p-3 text-sm text-tomato">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {queue.error.message}
          </p>
        )}

        {sent && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-basil-soft p-3 text-sm text-basil">
            <Check className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Got it — it’s in the queue.</strong> Nothing was invented and nothing was
              published yet. Once it’s read and checked it shows up in Today and Feed with your text
              quoted as the evidence.
            </span>
          </p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-display text-xl font-extrabold">Recent tips</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Every paste is kept, published or not — same provenance rule as the scraper.
        </p>

        {recent.isLoading && <Loader2 className="mt-4 size-4 animate-spin text-ink-soft" />}
        {recent.data?.length === 0 && (
          <p className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
            <Clipboard className="size-4" /> Nothing submitted yet.
          </p>
        )}

        <div className="mt-4 space-y-2">
          {(recent.data ?? []).map((s) => (
            <div key={s.id} className="card flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span
                className={cn(
                  "chip",
                  s.status === "published"
                    ? "bg-basil-soft text-basil"
                    : s.status === "failed"
                      ? "bg-tomato-soft text-tomato"
                      : s.status === "drafted"
                        ? "bg-ember-soft text-ember"
                        : "bg-line/70 text-ink-soft",
                )}
              >
                {s.status === "queued" ? "waiting" : s.status}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {s.eventTitle ?? s.rawInput.slice(0, 70)}
              </span>
              {s.eventHasFood && (
                <span className="chip bg-tomato-soft text-tomato">
                  <Utensils className="size-3" /> food
                </span>
              )}
              <span className="tnum text-xs text-ink-soft">
                {new Date(s.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </Layout>
  );
}

export default SubmitPage;
