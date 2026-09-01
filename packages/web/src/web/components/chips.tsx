import { CircleAlert, Coffee, Ticket, UtensilsCrossed } from "lucide-react";
import { cn } from "../lib/utils";

const ORG_COLORS: Record<string, string> = {
  Vanderbilt: "#B58A2B",
  Belmont: "#1F4FA3",
  Lipscomb: "#7A2E6D",
  Trevecca: "#1F8A5B",
  TSU: "#0B6BB5",
  Fisk: "#B5322B",
};

export function CampusDot({ org }: { org: string }) {
  const color = ORG_COLORS[org] ?? "#6B625C";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
      <span className="size-2 rounded-full" style={{ background: color }} />
      {org}
    </span>
  );
}

const FOOD_LABEL = ["No food", "Drinks", "Snacks", "Light meal", "Full meal"];

export function FoodBadge({ value, type }: { value: number; type?: string | null }) {
  const label = FOOD_LABEL[Math.max(0, Math.min(4, value))];
  const Icon = value <= 1 ? Coffee : UtensilsCrossed;
  return (
    <span className="chip bg-tomato-soft text-tomato">
      <Icon className="size-3.5" />
      {label}
      {type ? <span className="font-normal opacity-80">· {type}</span> : null}
    </span>
  );
}

export function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = pct >= 80 ? "bg-basil" : pct >= 50 ? "bg-ember" : "bg-ink-soft/40";
  const text = pct >= 80 ? "text-basil" : pct >= 50 ? "text-ember" : "text-ink-soft";
  return (
    <span className="inline-flex items-center gap-1.5" title="How sure the extractor is that food is provided">
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line">
        <span className={cn("block h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className={cn("tnum text-xs font-semibold", text)}>{pct}%</span>
    </span>
  );
}

const ELIGIBILITY: Record<string, { label: string; className: string }> = {
  public: { label: "Open to public", className: "bg-basil-soft text-basil" },
  students_welcome: { label: "Students welcome", className: "bg-basil-soft text-basil" },
  school_only: { label: "That school only", className: "bg-ember-soft text-ember" },
  invite_only: { label: "Invite / registration", className: "bg-berry-soft text-berry" },
  unknown: { label: "Eligibility unclear", className: "bg-line/60 text-ink-soft" },
};

export function EligibilityChip({ value }: { value: string }) {
  const e = ELIGIBILITY[value] ?? ELIGIBILITY.unknown!;
  return <span className={cn("chip", e.className)}>{e.label}</span>;
}

export function UnconfirmedChip() {
  return (
    <span className="chip bg-line/60 text-ink-soft">
      <CircleAlert className="size-3.5" />
      Food not confirmed
    </span>
  );
}

export function PaidChip() {
  return (
    <span className="chip bg-ember-soft text-ember">
      <Ticket className="size-3.5" />
      Costs money
    </span>
  );
}
