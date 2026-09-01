# Nashville Campus Radar — Design System

Clean, modern, light "food app" energy. Warm and appetizing, but the data must read as
trustworthy — every food claim carries a confidence number and a source link.

## Typography

- Display: **Bricolage Grotesque** (700/800) — headings, campus names, big numbers.
- Body: **DM Sans** (400/500/600) — everything else.
- Loaded from Google Fonts in `index.html`. Line-height generous (1.6 body, 1.05 display).
- Numbers/times use tabular figures (`font-variant-numeric: tabular-nums`).

## Color

| Token | Value | Use |
|---|---|---|
| `--bg` | `#FBF7F2` warm off-white | page background |
| `--surface` | `#FFFFFF` | cards |
| `--ink` | `#1A1614` deep charcoal | primary text |
| `--ink-soft` | `#6B625C` | secondary text |
| `--tomato` | `#E8442B` | primary accent, CTAs, food badges |
| `--ember` | `#F59B23` | secondary accent, warnings, "unconfirmed" |
| `--basil` | `#1F8A5B` | confirmed food, success, public eligibility |
| `--berry` | `#7A2E6D` | networking/academic value chips |
| `--line` | `#EBE2D8` | hairline borders |

Accent is used for emphasis, never decoration. No purple-on-white gradients.

### Interface themes

Six palettes, switchable from the RGB switch in the header. Themes swap **CSS custom
properties only** — layout, type, spacing and content are byte-identical across all six,
so every card, chip and meter recolors together with no per-component color props.

| Theme | Id | Feel | Accent trio |
|---|---|---|---|
| Tomato | `tomato` | The original (default) | `#E8442B` `#F59B23` `#1F8A5B` |
| Grape soda | `grape` | Purple + pink | `#8A3FD1` `#E0499B` `#2F8F86` |
| Mint | `mint` | Cool and calm | `#0E9F6E` `#E8A33C` `#3D7BAF` |
| Lagoon | `lagoon` | Blue hour | `#2563EB` `#F59B23` `#1F8A5B` |
| Sunset | `sunset` | Hot pink glow | `#E11D6B` `#FB8C00` `#2F8A55` |
| Midnight | `midnight` | Lights off (dark) | `#FF6B4A` `#FFB53D` `#35D399` |

Rules:

- Overrides live in `styles.css` as `html[data-theme="<id>"]` blocks. The `html` prefix is
  required: Tailwind 4 emits its tokens as `:root, :host`, and a bare `[data-theme]`
  selector ties that specificity — the theme would silently lose for every utility class.
- Each block redefines `bg`, `surface` (midnight only), `ink`, `ink-soft`, the four accents
  and their `-soft` variants, `line`, plus `--glow-a` / `--glow-b` / `--grain` which drive
  the body's ambient radial gradients and grain.
- Midnight inverts the contrast direction: `ink` becomes the *bright* color, so
  `html[data-theme="midnight"] .text-white` is flipped dark. Any new `bg-ink text-white` or
  `bg-tomato text-white` block must use `text-white` (not a hardcoded hex) to inherit that flip.
- Choice persists in `localStorage` under `campus-radar.theme` and is re-applied by an inline
  script in `index.html` before first paint to avoid a flash of the default palette. Every
  storage access is wrapped in try/catch so the switch degrades to in-memory in sandboxed frames.

## Layout

- Max width 1180px, 24px gutters.
- Asymmetric: Today page = wide ranked timeline (2fr) + sticky "best campus" panel (1fr).
- Density is intentional — event rows are compact, the hero call-out is oversized.
- Cards: 18px radius, 1px `--line` border, soft shadow `0 1px 2px rgba(26,22,20,.05)`.
- Background texture: subtle warm radial wash top-left + faint dotted grid, never flat gray.

## Components

- **FoodBadge** — tomato pill with fork icon, `$`–`$$$$` food value, e.g. "Full meal".
- **ConfidenceMeter** — small bar + `%`; ≥80 basil, 50–79 ember, <50 gray "unconfirmed".
- **EligibilityChip** — public (basil) / students welcome (basil-soft) / school-only (ember) /
  invite-only (gray). Never hidden; honesty is the product.
- **SourceLink** — "View original ›" always visible on every event.
- **CampusDot** — one fixed color per school for fast scanning.

## Motion

One orchestrated page load: header fades, timeline rows stagger in 40ms apart, hero number
counts up. CSS-only. No scattered hover gimmicks.

## Voice

Plain and blunt. "3 confirmed free meals today." Never invent certainty —
unverified events say "food not confirmed" rather than being dropped.
