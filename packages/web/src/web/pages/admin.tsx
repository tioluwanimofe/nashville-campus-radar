import { useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Compass,
  Inbox,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  TriangleAlert,
  Utensils,
  XCircle,
} from "lucide-react";
import { Layout } from "../components/layout";
import { DraftReview, type RawDraft } from "../components/draft-review";
import { WorkingPrinciple } from "../components/working-principle";
import {
  useAddSource,
  useRawForRun,
  useRemoveSource,
  useRunAll,
  useRunSource,
  useRuns,
  useSources,
  useToggleSource,
} from "../queries/sources";
import {
  useDraftedSubmissions,
  useExtractQueued,
  useExtractSubmission,
  useQueueCount,
  useQueuedSubmissions,
  useRemoveSubmission,
} from "../queries/submissions";
import { useSignals } from "../queries/signals";
import { useAdminKey } from "../lib/alpha";
import { cn } from "../lib/utils";

function StatusIcon({ status }: { status: string | null }) {
  if (status === "ok") return <CheckCircle2 className="size-4 text-basil" />;
  if (status === "partial") return <TriangleAlert className="size-4 text-ember" />;
  if (status === "error") return <XCircle className="size-4 text-tomato" />;
  return <span className="size-4 rounded-full border border-line" />;
}

function RunInspector({ runId }: { runId: number }) {
  const raw = useRawForRun(runId);
  if (raw.isLoading) {
    return (
      <div className="p-4 text-sm text-ink-soft">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }
  const rows = raw.data ?? [];
  if (rows.length === 0) {
    return <p className="p-4 text-sm text-ink-soft">No raw text was captured for this run.</p>;
  }
  return (
    <div className="space-y-3 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
        Raw text the model read ({rows.length} of this run’s records)
      </p>
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-line bg-bg/60 p-3">
          <p className="mb-1 text-xs font-semibold">{r.title ?? "(page text chunk)"}</p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[11px] leading-relaxed text-ink-soft">
            {r.rawText}
          </pre>
        </div>
      ))}
    </div>
  );
}

/** The gate. Everything that spends credits lives behind this one field. */
function KeyPanel({
  keyValue,
  unlocked,
  onSave,
  onClear,
}: {
  keyValue: string;
  unlocked: boolean;
  onSave: (v: string) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(keyValue);
  return (
    <div
      className={cn(
        "card mb-6 flex flex-wrap items-center gap-3 border-l-4 p-4",
        unlocked ? "border-l-basil" : "border-l-ember",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          unlocked ? "bg-basil-soft text-basil" : "bg-ember-soft text-ember",
        )}
      >
        {unlocked ? <LockOpen className="size-5" /> : <Lock className="size-5" />}
      </span>
      <div className="min-w-48 flex-1">
        <p className="font-display text-base font-bold">
          {unlocked ? "Credit actions unlocked on this device" : "Credit actions locked"}
        </p>
        <p className="text-xs text-ink-soft">
          Scanning sources and reading submissions are the only things in this app that spend AI
          credits. They need the admin key; everything else — Today, Feed, submitting an event — is
          free and open to everyone.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-ink-soft" />
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="admin key"
          className="w-44 rounded-xl border border-line px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => onSave(draft.trim())}
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-tomato"
        >
          Unlock
        </button>
        {keyValue ? (
          <button
            type="button"
            onClick={() => {
              onClear();
              setDraft("");
            }}
            className="rounded-full border border-line px-3 py-2 text-sm font-semibold text-ink-soft"
          >
            Forget
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="card p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">{label}</p>
      <p
        className={cn(
          "tnum mt-1 font-display text-3xl font-extrabold",
          tone === "good" && "text-basil",
          tone === "warn" && "text-tomato",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    </div>
  );
}

const INTENT_LABELS: Record<string, string> = {
  food_now: "Free food right now",
  food_today: "Free food today",
  this_week: "This week",
  study: "Study spots",
  open_to_all: "Open to anyone",
};

/** The alpha scoreboard. Free to read — no credits involved. */
function SignalsPanel() {
  const signals = useSignals();
  const s = signals.data;
  const rate = s?.discoveryRate;

  return (
    <section className="mb-8">
      <h2 className="mb-1 flex items-center gap-2 font-display text-2xl font-bold">
        <Target className="size-5 text-tomato" />
        Alpha signals
      </h2>
      <p className="mb-3 text-sm text-ink-soft">
        The only numbers that decide whether this app deserves to exist. Blank means nobody has
        answered yet — not zero.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Discovery rate"
          value={rate === null || rate === undefined ? "—" : `${Math.round(rate * 100)}%`}
          hint={
            s
              ? `${s.discoveries} of ${s.answeredKnew} said they would NOT have known otherwise`
              : "loading"
          }
          tone={rate !== null && rate !== undefined && rate >= 0.5 ? "good" : undefined}
        />
        <Metric
          label="Testers"
          value={s ? String(s.testers) : "—"}
          hint={`${s?.responses ?? 0} total responses`}
        />
        <Metric
          label="Food confirmed"
          value={s ? `${s.foodConfirmed}` : "—"}
          hint={`${s?.went ?? 0} people said they actually went`}
          tone="good"
        />
        <Metric
          label="False positives"
          value={s ? String(s.falsePositives) : "—"}
          hint="AI said food, a human on the ground said no"
          tone={(s?.falsePositives ?? 0) > 0 ? "warn" : undefined}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            <Compass className="size-3.5" /> What people actually pressed
          </p>
          <div className="mt-3 space-y-2">
            {(s?.intents ?? []).map((i) => (
              <div key={i.intent} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold">{INTENT_LABELS[i.intent] ?? i.intent}</span>
                <span className="tnum text-xs text-ink-soft">
                  {i.taps} taps
                  {i.empty > 0 ? (
                    <span className="ml-2 text-tomato">{i.empty} returned nothing</span>
                  ) : null}
                </span>
              </div>
            ))}
            {(s?.intents.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-soft">No intent taps yet.</p>
            ) : null}
          </div>
        </div>

        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            Latest ground truth
          </p>
          <div className="mt-3 space-y-2">
            {(s?.recent ?? []).map((r, i) => (
              <div key={`${r.eventId}-${i}`} className="text-sm">
                <p className="truncate font-semibold">{r.title ?? `event ${r.eventId}`}</p>
                <p className="text-xs text-ink-soft">
                  {r.wentThere === true ? "went" : r.wentThere === false ? "didn’t go" : "—"}
                  {r.hadFood !== null ? ` · food: ${r.hadFood ? "yes" : "no"}` : ""}
                  {r.knewAlready !== null
                    ? ` · ${r.knewAlready ? "already knew" : "found it here"}`
                    : ""}
                  {r.aiSaidFood ? ` · AI said food @ ${Math.round((r.aiConfidence ?? 0) * 100)}%` : ""}
                </p>
              </div>
            ))}
            {(s?.recent.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-soft">
                Nobody has answered “did you go?” yet. That’s the first thing to chase in alpha.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Student pastes waiting on an AI call, and drafts waiting on a human decision. */
function QueuePanel({ adminKey, unlocked }: { adminKey: string; unlocked: boolean }) {
  const queued = useQueuedSubmissions();
  const drafted = useDraftedSubmissions();
  const counts = useQueueCount();
  const extractOne = useExtractSubmission();
  const extractAll = useExtractQueued();
  const removeOne = useRemoveSubmission();

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
            <Inbox className="size-5 text-tomato" />
            Submission queue
          </h2>
          <p className="text-sm text-ink-soft">
            Students paste for free — no model runs on send. One AI call each happens here, when you
            press the button.{" "}
            {counts.data
              ? `${counts.data.queued} waiting · ${counts.data.drafted} drafted · ${counts.data.published} published · ${counts.data.failed} rejected`
              : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={!unlocked || extractAll.isPending || (counts.data?.queued ?? 0) === 0}
          onClick={() => extractAll.mutate({ adminKey, limit: 10 })}
          className="inline-flex items-center gap-2 rounded-full bg-tomato px-4 py-2 text-sm font-bold text-white transition disabled:opacity-40"
        >
          {extractAll.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          Read next 10 ({counts.data?.queued ?? 0} waiting)
        </button>
      </div>

      {extractAll.isError && (
        <p className="mb-3 rounded-xl bg-tomato-soft p-3 text-sm text-tomato">
          {extractAll.error.message}
        </p>
      )}

      <div className="card mb-4 divide-y divide-line overflow-hidden">
        {(queued.data ?? []).map((s) => (
          <div key={s.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
            <span className="chip bg-line/70 text-ink-soft">waiting</span>
            <div className="min-w-48 flex-1">
              <p className="whitespace-pre-wrap text-sm">{s.rawInput.slice(0, 260)}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {s.org ?? "campus not given"} ·{" "}
                {new Date(s.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {s.submitterNote ? ` · note: ${s.submitterNote}` : ""}
              </p>
            </div>
            <button
              type="button"
              disabled={!unlocked || extractOne.isPending}
              onClick={() => extractOne.mutate({ id: s.id, adminKey })}
              className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-tomato hover:text-tomato disabled:opacity-40"
            >
              {extractOne.isPending && extractOne.variables?.id === s.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5" />
              )}
              Read it
            </button>
            <button
              type="button"
              disabled={!unlocked}
              onClick={() => removeOne.mutate({ id: s.id, adminKey })}
              className="rounded-full border border-line p-1.5 text-ink-soft transition hover:border-tomato hover:text-tomato disabled:opacity-40"
              aria-label="Discard submission"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {(queued.data?.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-ink-soft">
            Nothing waiting. Every paste has been read.
          </p>
        ) : null}
      </div>

      {(drafted.data?.length ?? 0) > 0 && (
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-soft">
            Read and waiting on you
          </p>
          {(drafted.data ?? []).map((s) => {
            let raw: RawDraft | null = null;
            try {
              raw = s.draftJson ? (JSON.parse(s.draftJson) as RawDraft) : null;
            } catch {
              raw = null;
            }
            if (!raw) {
              return (
                <p key={s.id} className="card p-4 text-sm text-ink-soft">
                  Submission {s.id} has no readable draft. Re-read it from the queue.
                </p>
              );
            }
            return (
              <DraftReview
                key={s.id}
                submissionId={s.id}
                raw={raw}
                fallbackUrl={s.fetchedUrl ?? ""}
                adminKey={adminKey}
              />
            );
          })}
        </div>
      )}

      {(queued.data ?? []).length === 0 && (drafted.data ?? []).length === 0 ? null : null}

      {/* Rejected pastes are kept, never silently dropped. */}
    </section>
  );
}

function AdminConsole({
  adminKey,
  save,
  clear,
}: {
  adminKey: string;
  save: (v: string) => void;
  clear: () => void;
}) {
  const unlocked = adminKey.length > 0;

  const sources = useSources();
  const runs = useRuns();
  const runOne = useRunSource();
  const runAll = useRunAll();
  const addSource = useAddSource();
  const toggleSource = useToggleSource();
  const removeSource = useRemoveSource();

  const [openRun, setOpenRun] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    org: "",
    url: "",
    kind: "html" as "html" | "rss" | "tribe",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.org || !form.url) return;
    addSource.mutate(
      { ...form, adminKey },
      { onSuccess: () => setForm({ name: "", org: "", url: "", kind: "html" }) },
    );
  };

  return (
    <Layout>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-tomato">
            Pipeline control
          </p>
          <h1 className="mt-1.5 font-display text-4xl font-extrabold">Admin</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Fetch → parse → LLM extraction. Failures are shown as they happen, not hidden.
          </p>
        </div>
        <button
          type="button"
          onClick={() => runAll.mutate({ adminKey })}
          disabled={!unlocked || runAll.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-tomato disabled:opacity-40"
        >
          {runAll.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {runAll.isPending ? "Running every source…" : "Refresh all (~12-15 AI calls)"}
        </button>
      </div>

      <KeyPanel keyValue={adminKey} unlocked={unlocked} onSave={save} onClear={clear} />

      {runAll.isError && (
        <p className="mb-6 rounded-xl bg-tomato-soft p-3 text-sm text-tomato">
          {runAll.error.message}
        </p>
      )}

      <SignalsPanel />
      <QueuePanel adminKey={adminKey} unlocked={unlocked} />

      <h2 className="mb-3 flex items-center gap-2 font-display text-2xl font-bold">
        <Utensils className="size-5 text-tomato" />
        Sources
      </h2>
      <div className="card mb-6 overflow-hidden">
        {sources.isLoading ? (
          <div className="grid h-32 place-items-center text-ink-soft">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <div className="divide-y divide-line">
            {(sources.data ?? []).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <StatusIcon status={s.lastStatus} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {s.name}
                    <span className="ml-2 text-xs font-normal text-ink-soft">{s.org}</span>
                    <span className="ml-2 chip bg-line/60 text-ink-soft">{s.kind}</span>
                  </p>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-xs text-ink-soft hover:text-tomato"
                  >
                    {s.url}
                  </a>
                  {s.lastError ? (
                    <p className="mt-0.5 text-xs text-tomato">{s.lastError}</p>
                  ) : null}
                </div>

                <div className="tnum hidden w-40 text-right text-xs text-ink-soft sm:block">
                  {s.lastRunAt ? (
                    <>
                      <strong className="text-ink">{s.lastEventCount}</strong> events ·{" "}
                      {s.lastCandidateCount} candidates
                      <br />
                      {new Date(s.lastRunAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </>
                  ) : (
                    "never run"
                  )}
                </div>

                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() =>
                    toggleSource.mutate({ id: s.id, enabled: !s.enabled, adminKey })
                  }
                  className={cn(
                    "chip border disabled:opacity-40",
                    s.enabled
                      ? "border-basil/30 bg-basil-soft text-basil"
                      : "border-line text-ink-soft",
                  )}
                >
                  {s.enabled ? "enabled" : "paused"}
                </button>

                <button
                  type="button"
                  onClick={() => runOne.mutate({ id: s.id, adminKey })}
                  disabled={!unlocked || runOne.isPending}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold transition hover:border-tomato hover:text-tomato disabled:opacity-40"
                >
                  {runOne.isPending && runOne.variables?.id === s.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                  Run
                </button>

                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => removeSource.mutate({ id: s.id, adminKey })}
                  className="rounded-full border border-line p-1.5 text-ink-soft transition hover:border-tomato hover:text-tomato disabled:opacity-40"
                  aria-label="Remove source"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={submit} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-40">
          <label className="text-xs font-semibold text-ink-soft">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Belmont Student Involvement"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
        </div>
        <div className="w-36">
          <label className="text-xs font-semibold text-ink-soft">Campus / org</label>
          <input
            value={form.org}
            onChange={(e) => setForm({ ...form, org: e.target.value })}
            placeholder="Belmont"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-[2] min-w-56">
          <label className="text-xs font-semibold text-ink-soft">URL</label>
          <input
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            placeholder="https://…"
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          />
        </div>
        <div className="w-28">
          <label className="text-xs font-semibold text-ink-soft">Kind</label>
          <select
            value={form.kind}
            onChange={(e) =>
              setForm({ ...form, kind: e.target.value as "html" | "rss" | "tribe" })
            }
            className="w-full rounded-xl border border-line px-3 py-2 text-sm"
          >
            <option value="html">html</option>
            <option value="rss">rss</option>
            <option value="tribe">tribe</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={!unlocked || addSource.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-tomato px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {addSource.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add source
        </button>
        {addSource.isError ? (
          <p className="w-full text-xs text-tomato">{addSource.error.message}</p>
        ) : null}
      </form>

      <h2 className="mb-3 font-display text-2xl font-bold">Run log</h2>
      <div className="card divide-y divide-line overflow-hidden">
        {(runs.data ?? []).map((r) => (
          <div key={r.id}>
            <button
              type="button"
              onClick={() => setOpenRun(openRun === r.id ? null : r.id)}
              className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left"
            >
              <StatusIcon status={r.status} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                {r.sourceName ?? `source ${r.sourceId}`}
              </span>
              <span className="tnum text-xs text-ink-soft">
                HTTP {r.httpStatus ?? "—"} · {((r.bytes ?? 0) / 1024).toFixed(0)} KB ·{" "}
                {r.candidateCount} candidates → <strong className="text-ink">{r.eventCount}</strong>{" "}
                events · <strong className="text-tomato">{r.foodCount}</strong> food
              </span>
              <span className="tnum text-xs text-ink-soft">
                {new Date(r.startedAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              <ChevronDown
                className={cn("size-4 text-ink-soft transition", openRun === r.id && "rotate-180")}
              />
            </button>
            {r.note || r.error ? (
              <p className="px-4 pb-2 text-xs text-ink-soft">
                {r.note}
                {r.error ? <span className="text-tomato"> — {r.error}</span> : null}
              </p>
            ) : null}
            {openRun === r.id ? <RunInspector runId={r.id} /> : null}
          </div>
        ))}
        {(runs.data?.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-ink-soft">No runs yet.</p>
        ) : null}
      </div>

      <div className="mt-10">
        <WorkingPrinciple />
      </div>
    </Layout>
  );
}

/**
 * Locked by default. A visitor without the key sees one card and nothing else —
 * no signals, no queue, no sources, no run log, no architecture notes.
 */
function AdminPage() {
  const { key: adminKey, save, clear } = useAdminKey();

  if (adminKey.length === 0) {
    return (
      <Layout>
        <div className="mx-auto max-w-xl py-16">
          <span className="grid size-12 place-items-center rounded-2xl bg-ember-soft text-ember">
            <Lock className="size-6" />
          </span>
          <h1 className="mt-5 font-display text-4xl font-extrabold">Admin</h1>
          <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-soft">
            Enter the admin key to manage sources and the submission queue. If you are here to find
            free food, you want <a href="/" className="font-semibold text-tomato">Today</a> instead
            — nothing on this page is needed to use the site.
          </p>

          <div className="card mt-6 p-5">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-ink-soft" />
              <p className="font-display text-base font-bold">Admin key</p>
            </div>
            <LockForm onSave={save} />
          </div>
        </div>
      </Layout>
    );
  }

  return <AdminConsole adminKey={adminKey} save={save} clear={clear} />;
}

function LockForm({ onSave }: { onSave: (v: string) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = draft.trim();
        if (v) onSave(v);
      }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <input
        type="password"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="admin key"
        className="min-w-40 flex-1 rounded-xl border border-line px-3 py-2 text-sm"
      />
      <button
        type="submit"
        className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white transition hover:bg-tomato"
      >
        Unlock
      </button>
    </form>
  );
}

export default AdminPage;
