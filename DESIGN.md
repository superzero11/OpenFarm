# OpenFarm design system

The rulebook for every surface in `apps/web`. Read it before writing or changing any UI, whether you are a contributor or a coding agent.
Source of truth for values: **`openfarm-tokens.css`** (token blocks live in `apps/web/src/app/globals.css`). Visual reference: **`docs/design/OpenFarm Design System.dc.html`** (open in a browser; the reference pages are standalone). The reference pages use inline styles so they render without a build step - never copy inline hex out of them; production code uses Tailwind classes reading the tokens.

---

## 0. The one rule

**Never write a raw colour, font size, spacing value, or icon size that is not in the token file.**
If you reach for `text-red-500`, `bg-blue-50`, `text-[13px]`, or `h-3.5 w-3.5`, stop - there is a token for it.

---

## 1. Colour

### Use
| Need | Token / class |
|---|---|
| Page background | `bg-background` |
| Card, panel | `bg-card` (`--surface-1`) |
| Inset well, table stripe, page wash | `bg-surface-2` |
| Popover, menu, floating map panel | `bg-surface-3` |
| Hairline | `border-border` · emphasised divider `border-strong` |
| Brand / primary action / active nav | `bg-primary`, `text-primary`, `bg-primary-subtle` |
| Good, healthy, within range | `success` |
| Needs watching | `warning` |
| Low-priority flag | `caution` |
| Failure, destructive, high severity | `danger` |
| Neutral explanation | `info` |

### Never
- Wrong: `text-red-600 dark:text-red-400` - Right: `text-danger`
- Wrong: `bg-amber-50 dark:bg-amber-950/30` - Right: `bg-warning-subtle`
- Wrong: `bg-green-500` for a risk meter - Right: `bg-success`
- Wrong: `bg-primary/10` for an icon well or active nav - Right: `bg-primary-subtle` (a different colour in dark mode, not a tint of the same one)
- Wrong: `bg-muted/50` for an inset well - Right: `bg-surface-2`
- Wrong: inventing a hue for a new metric - Right: pick from the eight `sig-*` signal colours

A token that exists in `globals.css` but is not exposed in `tailwind.config.js` is invisible: the class silently does not exist and Tailwind emits nothing. When you add a token, add it to both.

### Domain signal colours are permanent bindings
One quantity, one hue, across map, chart, legend, badge and table.

```
vegetation NDVI/EVI/SAVI, biomass    sig-vegetation (green)
water      NDWI, balance, irrigation sig-water     (blue)
precip     rainfall                  sig-precip    (sky)
temp       air/soil temp, GDD        sig-temp      (orange)
et0        evapotranspiration        sig-et0       (amber)
vpd        vapour pressure deficit   sig-vpd       (cyan)
carbon     SOC, sequestration        sig-carbon    (emerald)
yield      yield & forecast models   sig-yield     (violet)
soil texture                         soil-sand / soil-silt / soil-clay
```

### Severity has exactly three levels
`high: sev-high` · `medium: sev-medium` · `low: sev-low`.
Rendered as: icon (`ShieldAlert` / `AlertTriangle` / `Bell`) + uppercase micro badge + optional dot. Never colour the whole row background by severity.

### Raster ramps
NDVI / EVI / SAVI use `--ramp-vegetation` (rdylgn). NDWI uses `--ramp-water` (rdbu).
The CSS gradient in the legend and the TiTiler `colormap` **must** be the same ramp. Changing one without the other is a bug.

---

## 2. Typography

`IBM Plex Sans` for everything; `IBM Plex Mono` for **measured values** - index readouts, coordinates, dates in tables, areas, thresholds, IDs.

| Role | Size / weight | Class |
|---|---|---|
| Page title | 24 / 700 / -0.02em | `text-2xl font-bold tracking-tight` |
| Card & panel title | 18 / 600 | `text-lg font-semibold` |
| Panel section head | 15 / 600 | `text-[15px] font-semibold` |
| Body | 14 / 400 | `text-sm` |
| Dense body | 13 / 400 | `text-[13px]` |
| Label, meta | 12 / 500 | `text-xs font-medium` |
| Legend, unit, caption | 11 / 400 | `text-[11px]` |
| Micro pill, tag | 10 / 600 / .06em uppercase | `text-[10px] font-semibold uppercase tracking-wider` |
| Stat metric | 24 / 700 tabular | `text-2xl font-bold tabular-nums` |

Rules
- **Only five text sizes on a screen.** If you need a sixth, the hierarchy is wrong.
- Any number that updates gets `tabular-nums`. Any measured value gets `font-mono`.
- Sentence case for everything except micro pills. No title case, no ALL-CAPS headings. This applies to message files too: `"Open alerts"`, never `"Open Alerts"`.
- Never go below 11px. 10px is reserved for uppercase micro pills only.

**One exception: the marketing surface.** `components/landing-page.tsx` and
`components/marketing/` follow screen 06 of `OpenFarm Screens.dc.html`, which
uses its own display scale (52 / 32 / 22 / 17px) and half steps (13.5 / 12.5 /
11.5 / 10.5px). That is deliberate and matches the reference file. Nothing
behind the login may use those sizes.

---

## 3. Space, radius, elevation

- Spacing is the 4px scale: `1 2 3 4 5 6 8 10 12`. Nothing else, no arbitrary `p-[13px]`.
- Standard paddings: **card `p-5`**, **panel section `p-4`**, **dense list row `p-3`**, **compact sidebar item `px-3 py-2`**, **page `p-6 lg:p-8`**.
- Gaps, not margins: `flex`/`grid` + `gap-*` for every sibling group.
- Radius: `rounded-md` inputs & menu items · `rounded-lg` cards, buttons, panels · `rounded-xl` floating map panels · `rounded-full` pills, avatars, badges.
- Elevation ladder - do not skip steps: flat (`border` only), `shadow-sm` cards, `shadow-md` dropdowns/popovers, `shadow-lg` dialogs, `shadow-panel` map overlays.
- Content caps at `max-w-6xl mx-auto`. The map is the only full-bleed surface.

---

## 4. Icons

`lucide-react` only. Stroke width 2 (default) - never restyle it.

| Context | Size |
|---|---|
| Sidebar nav, stat card, quick action | `h-5 w-5` (20) |
| Button, input adornment, list row | `h-4 w-4` (16) |
| Dense meta, inline in caption | `h-3 w-3` (12) |

Icons inherit `currentColor`. An icon never carries meaning alone - always paired with a label or an accessible name.

**Fixed icon vocabulary** (do not substitute):
`LayoutDashboard` dashboard · `Tractor` farm · `Map` field · `Leaf` brand/vegetation · `Bell` alert · `ShieldAlert` high severity · `AlertTriangle` medium severity · `CloudRain` weather/precip · `Layers` soil · `Droplets` water/moisture · `Thermometer` temperature · `Sun` clear/GDD · `Users` members · `Settings` settings · `ScrollText` changelog · `Crosshair` scouting point · `Share2` share · `Play` run analysis · `Eye` layer visibility.

---

## 5. Component rules

**Button** - `default` (one primary per view), `secondary`, `outline`, `ghost` (icon actions, list affordances), `destructive` (only for irreversible acts, always behind a confirm), `link`. Sizes `sm 36 / default 40 / lg 44 / icon 40`. Loading = `Loader2 animate-spin` replacing the leading icon, label unchanged, button disabled.

**Card** - `rounded-lg border bg-card shadow-sm`. Header `p-5 pb-3`, content `p-5 pt-0`. Card titles are `text-lg font-semibold`, never `text-2xl`.

**Stat card** - icon + label row, metric on its own line, optional sublabel. Metric is `text-2xl font-bold tabular-nums`. Never put a sparkline inside without also giving it an axis-free caption.

**Link** - **never underlined**, in any state. A link is `text-primary font-medium`, and hover shifts the colour (`hover:text-primary/80`). Underlines make text reflow under the cursor and collide with the mono values and chips these links sit beside. `hover:underline` and `underline` are as wrong here as a raw hex: the global `a { text-decoration: none }` in `globals.css` is the backstop, not the permission to add one locally. Anything that needs a stronger affordance is a `Button`, not a link.

**Badge** - `rounded-full`, `text-[10px] uppercase font-semibold tracking-wider` for status/severity; `text-xs` for counts. Outline variant for inert states (`Closed`).

**Tabs** - `underline` variant for in-page navigation (field detail panel); `default` pill variant only inside a card for switching a single dataset.

**List row** - `rounded-lg border p-3` (dense) or `p-4`, `hover:border-primary/30`, trailing `ChevronRight` when navigable, trailing action button when not. Never both.

**Anything floating over imagery** - toolbar, style switcher, search, zoom stack, legend, provenance bar and the analysis panel all share one scrim: `MAP_CHROME` from `lib/design-tokens.ts` (`bg-surface-3/95 backdrop-blur border border-border shadow-panel`). Import it, never re-type it - the whole point is that a control cannot drift onto a different background from the panel beside it.

**Map analysis panel** - `w-[var(--panel-w)]` (22rem), `MAP_CHROME`, `rounded-xl`, sections separated by `border-t`, section head `text-[15px] font-semibold`. Panel scrolls; map never does. The legend and the provenance bar are `rounded-lg`, not `rounded-xl` - only the panel gets the larger radius.

**Provenance bar** - every map carrying a raster states where it came from: satellite, date, cloud cover and colormap on one mono 11px line over `hsl(var(--map-scrim) / 0.82)`. A rendered pixel with no visible source is a bug.

**Empty state** - dashed `border-2 border-dashed rounded-lg p-12 text-center`, muted 48px icon, one-line what, one-line why, one primary action.

**Loading** - `Skeleton` blocks matching the real layout's boxes. Never a centred spinner for page load. Spinners only inside buttons and for sub-second in-place refreshes.

**Error / info callout** - `rounded-lg border bg-{status}-subtle p-3 text-[13px]` with a 16px status icon. Never a bare coloured background with no border.

---

## 6. Data visualisation (ECharts)

- Series colours come from `--viz-1..8` **in order**, unless the series is a named quantity - then it takes its `sig-*` colour and ignores the order.
- Grid: horizontal only, `hsl(var(--border))`, 1px, dashed. No vertical gridlines, no chart border, no background fill.
- Axis labels `11px` `--muted-foreground`; axis lines hidden except the zero line.
- Time series with distribution: p10-p90 band at 15% opacity of the series colour, median as a 2px line, points 4px.
- Threshold lines are dashed 1px in `--danger` with a right-aligned inline label.
- Tooltips reuse the popover tokens: `bg-surface-3`, `border`, `shadow-md`, `rounded-md`, 12px text, mono values.
- Every chart states its unit once, in the axis or the title - never repeated per tick.
- No pie charts, no 3D, no gradient fills under lines except a single 12% to 0% wash of the series colour.

---

## 7. Content & copy

- **Sentence case.** "Run NDVI analysis", not "Run NDVI Analysis".
- **Units always attached**, thin space before: `12.4 ha`, `28 mm`, `0.68` (unitless indices carry no unit). Temperature `21.3 °C`.
- **Precision:** indices 3 dp · areas 2 dp · mm and °C 1 dp · percentages 0 dp · counts integer.
- **Dates:** `2026-02-08` (ISO, mono) inside data tables and layer lists; `8 Feb` in prose and chart axes; relative ("2 days ago") only for activity feeds.
- **Nulls:** `-` (hyphen), muted. Never `N/A`, `null`, `0`, or a blank cell.
- **Explain the number.** Every derived score shows its inputs or a limiting factor next to it - this is the product's promise. A number with no "why" is a bug.
- **Voice:** direct, agronomic, no hype. "NDVI dropped 18% in 14 days" not "Uh oh! Your crop may be in trouble!"
- **Alerts** name the observation, the magnitude, and the window. Weather/soil context is appended as muted meta, never as body text.
- No emoji. No exclamation marks. Never say "AI" when you mean "model" or "estimate".
- Confidence and provenance are first-class: any modelled value shows its source (`Sentinel-2 · 2026-02-08`) or its confidence.

---

## 8. Accessibility & state

- Body text at least 4.5:1, large text and UI edges at least 3:1 - verify in **both** themes, dark first.
- Colour is never the only carrier: severity = colour **+** icon **+** text; map layers = colour **+** legend.
- Every interactive element has a visible `:focus-visible` ring (`--ring`, 2px, 2px offset).
- Hit targets at least 40px on desktop, 44px on touch.
- Respect `prefers-reduced-motion`: drop panel/sidebar transitions, keep opacity fades.
- Every component ships all five states: default, hover, focus, active/selected, disabled - plus loading and empty where data-bound.

---

## 9. Adding something new

1. Find the closest existing pattern in `docs/design/OpenFarm Design System.dc.html` and copy it.
2. If it needs a new colour, it needs a new token in the token layer of `globals.css`, in **both** themes, with a comment saying what it means.
3. If it needs a new size, it doesn't - use the scale.
4. New component: add it to the design system page in the same PR. A component that isn't in the system doesn't exist.
