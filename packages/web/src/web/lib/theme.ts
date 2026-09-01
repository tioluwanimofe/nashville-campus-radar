import { useCallback, useEffect, useState } from "react";

/**
 * Interface color themes. Every theme only swaps CSS custom properties —
 * layout, type, spacing and content are identical across all of them.
 */
export type ThemeId = "tomato" | "grape" | "mint" | "lagoon" | "sunset" | "midnight";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  blurb: string;
  /** Three-stop swatch for the picker. */
  swatch: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  { id: "tomato", name: "Tomato", blurb: "The original", swatch: ["#E8442B", "#F59B23", "#1F8A5B"] },
  { id: "grape", name: "Grape soda", blurb: "Purple + pink", swatch: ["#8A3FD1", "#E0499B", "#2F8F86"] },
  { id: "mint", name: "Mint", blurb: "Cool and calm", swatch: ["#0E9F6E", "#E8A33C", "#3D7BAF"] },
  { id: "lagoon", name: "Lagoon", blurb: "Blue hour", swatch: ["#2563EB", "#F59B23", "#1F8A5B"] },
  { id: "sunset", name: "Sunset", blurb: "Hot pink glow", swatch: ["#E11D6B", "#FB8C00", "#2F8A55"] },
  { id: "midnight", name: "Midnight", blurb: "Lights off", swatch: ["#FF6B4A", "#FFB53D", "#35D399"] },
];

const KEY = "campus-radar.theme";
const IDS = new Set<string>(THEMES.map((t) => t.id));

/** localStorage throws in sandboxed iframes, so every access is guarded. */
export function readTheme(): ThemeId {
  if (typeof document === "undefined") return "tomato";
  const fromDom = document.documentElement.dataset.theme;
  if (fromDom && IDS.has(fromDom)) return fromDom as ThemeId;
  try {
    const stored = window.localStorage.getItem(KEY);
    if (stored && IDS.has(stored)) return stored as ThemeId;
  } catch {
    /* storage blocked — fall back to the default palette */
  }
  return "tomato";
}

function remember(id: ThemeId) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked — theme stays in memory for this session */
  }
}

function apply(id: ThemeId) {
  document.documentElement.dataset.theme = id;
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(readTheme);

  useEffect(() => {
    apply(theme);
    remember(theme);
  }, [theme]);

  const setTheme = useCallback((id: ThemeId) => setThemeState(id), []);

  const flip = useCallback(() => {
    setThemeState((current) => {
      const i = THEMES.findIndex((t) => t.id === current);
      return THEMES[(i + 1) % THEMES.length].id;
    });
  }, []);

  const index = Math.max(
    0,
    THEMES.findIndex((t) => t.id === theme),
  );

  return { theme, index, meta: THEMES[index], setTheme, flip };
}
