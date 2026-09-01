import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { THEMES, useTheme } from "../lib/theme";
import { cn } from "../lib/utils";

/**
 * A wall-switch for the interface colors. Clicking the plate flips to the next
 * palette; the swatch button opens the full picker. Colors only — nothing about
 * the data, layout or wording changes.
 */
export function ThemeSwitch() {
  const { theme, index, meta, setTheme, flip } = useTheme();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const up = index % 2 === 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative flex items-center gap-2">
      {/* The switch plate */}
      <span className="rgb-ring rounded-2xl">
        <button
          type="button"
          onClick={flip}
          aria-label={`Interface colors: ${meta.name}. Flip for the next palette.`}
          title={`${meta.name} — flip for the next palette`}
          className="flex h-11 w-8 flex-col justify-between rounded-2xl border border-line bg-surface p-1 shadow-sm transition active:scale-95"
        >
          <span
            className={cn(
              "grid h-[18px] w-full place-items-center rounded-xl transition-all duration-300 ease-out",
              up ? "translate-y-0 bg-tomato" : "translate-y-[20px] bg-ink",
            )}
          >
            <span className="h-[2px] w-3 rounded-full bg-white/80" />
          </span>
        </button>
      </span>

      {/* Palette picker */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Pick an interface color theme"
        className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-tomato hover:text-tomato"
      >
        <Palette className="size-3.5" />
        <span className="hidden sm:inline">{meta.name}</span>
        <span
          className="size-3 rounded-full"
          style={{
            background: `linear-gradient(135deg, ${meta.swatch[0]} 0 34%, ${meta.swatch[1]} 34% 67%, ${meta.swatch[2]} 67% 100%)`,
          }}
        />
      </button>

      {open ? (
        <div className="card absolute right-0 top-[52px] z-40 w-60 overflow-hidden p-1.5">
          <p className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            Interface colors
          </p>
          {THEMES.map((t) => {
            const active = t.id === theme;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition",
                  active ? "bg-tomato-soft" : "hover:bg-line/50",
                )}
              >
                <span
                  className="size-6 shrink-0 rounded-lg border border-line"
                  style={{
                    background: `linear-gradient(135deg, ${t.swatch[0]} 0 34%, ${t.swatch[1]} 34% 67%, ${t.swatch[2]} 67% 100%)`,
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm font-bold",
                      active ? "text-tomato" : "text-ink",
                    )}
                  >
                    {t.name}
                  </span>
                  <span className="block text-[11px] text-ink-soft">{t.blurb}</span>
                </span>
                {active ? <Check className="size-4 shrink-0 text-tomato" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
