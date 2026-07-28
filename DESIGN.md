---
name: Cinelog
description: A film & broadcast archive's labelling system — accession codes, gummed labels, and rubber-stamped states over your own shelf.
colors:
  vault-graphite: "#161918"
  shelf-shadow: "#111413"
  label-plane: "#1e2221"
  raised-stock: "#292e2c"
  card-stock: "#333937"
  rule-line: "#2d3331"
  rule-line-high: "#4a534f"
  label-ink: "#eae8e2"
  muted-ink: "#a0a39c"
  faint-ink: "#868c87"
  acetate-amber: "#fab03a"
  verdigris: "#58beb2"
  stamp-red: "#f05c64"
  reverse-ink: "#141816"
typography:
  display:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 3rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 79"
  headline:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "0.06em"
    fontVariation: "'wdth' 79"
  title:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.16em"
    fontVariation: "'wdth' 79"
  body:
    fontFamily: "Archivo Variable, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo Variable, Arial Narrow, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
    fontVariation: "'wdth' 79"
  data:
    fontFamily: "Courier Prime, Courier New, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
    fontFeature: "'tnum' 1"
rounded:
  sm: "1px"
  DEFAULT: "2px"
  md: "2px"
  lg: "3px"
  xl: "3px"
  2xl: "4px"
  3xl: "5px"
  full: "9999px"
spacing:
  hair: "4px"
  tight: "8px"
  snug: "10px"
  base: "12px"
  loose: "16px"
  section: "24px"
  band: "32px"
  major: "48px"
components:
  button-primary:
    backgroundColor: "{colors.acetate-amber}"
    textColor: "{colors.reverse-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "#fab03ae6"
    textColor: "{colors.reverse-ink}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.label-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.label}"
  button-secondary-hover:
    backgroundColor: "{colors.raised-stock}"
    textColor: "{colors.label-ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.label}"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.stamp-red}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.label}"
  input:
    backgroundColor: "{colors.shelf-shadow}"
    textColor: "{colors.label-ink}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.label-plane}"
    textColor: "{colors.label-ink}"
    rounded: "{rounded.sm}"
    padding: "12px"
  badge:
    backgroundColor: "{colors.raised-stock}"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.acetate-amber}"
    rounded: "{rounded.md}"
    padding: "0.2em 0.42em"
    typography: "{typography.label}"
  poster-tile:
    backgroundColor: "{colors.card-stock}"
    rounded: "{rounded.sm}"
    width: "100%"
  rating-badge:
    backgroundColor: "{colors.acetate-amber}"
    textColor: "{colors.reverse-ink}"
    rounded: "0px"
    padding: "3px 6px"
    typography: "{typography.data}"
  tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.label-ink}"
    rounded: "0px"
    padding: "10px 12px"
    typography: "{typography.label}"
---

# Design System: Cinelog

## Overview

**Creative North Star: "Archive & Accession"**

Cinelog looks like the back room of a film and broadcast archive, not its front of house. The whole interface is built from one archive's labelling kit: gummed classification labels, stencil-cut condensed caps, typewritten accession codes, rubber-stamped states, and sprocket-perforated rules. This is deliberately the opposite of the dark-glass streaming storefront every other tracker ships — the floating rounded card, the neon glow, the blurred pane. Nothing here floats and nothing here glows; printed matter sits on a shelf.

The ground is a cold near-neutral graphite with a faint green cast, and it is near-neutral for a load-bearing reason: every screen in this app is mostly poster artwork, and a tinted ground would falsify several hundred posters at once. Colour is treated as ink and stock, spent only where a mark actually means something. The result is dense, matte, and quiet, with the artwork consistently the loudest thing on any surface, which is the correct hierarchy for a shelf you built yourself.

Two materials carry the whole system. Archivo's variable width axis supplies the condensed uppercase label voice used for every heading, tab, button, and classification mark; Courier Prime carries every machine record — accession codes, dates, counts, runtimes, ratings. If a value was produced by the system rather than written by a person, it is typewritten. Both are self-hosted; a self-hosted instance may have no outbound internet, so no runtime CDN font can be depended on.

**Key Characteristics:**
- Vault-graphite near-neutral ground so poster art reads true
- Three inks with one job each: acetate amber (your marks), verdigris (system), stamp red (affection)
- Cut corners, never pill corners — labels are rectangles (1–5px radius scale)
- Every machine value typewritten in Courier Prime with tabular figures
- Matte, printed surfaces: no glow, no glass, no gradient fills on controls
- Exactly one authored motion in the entire app: the stamp strike
- A paper-tooth noise overlay at 5% so flat fields read as stock, not screen

## Colors

Ink and stock: a near-neutral graphite ground carrying three reserved inks, each assigned a single meaning.

### Primary
- **Acetate Amber** (`--gold`): The user's own marks. Primary buttons (amber field, dark reverse type), the active nav and tab underline, the rating badge on every poster tile, the WATCHLIST stamp, the star-rating fill, the ratings histogram bars, hover ring on poster tiles, and the "log" half of the wordmark. This is the only colour that appears as a filled field behind type.

### Secondary
- **Verdigris** (`--cyan`): Annotation and system voice — the WATCHED stamp, trailer and correction links, and progress indication. It marks what the archive knows, not what you feel.

### Tertiary
- **Stamp Red** (`--rose`): Affection only — the LIKED stamp, heart marks on tiles and lists, like counts, and the destructive button outline. Nothing else is permitted to use it.

### Neutral
- **Vault Graphite** (`--bg`): The page ground; every screen sits on it.
- **Shelf Shadow** (`--bg-2`): The topbar, input wells, and inset areas behind artwork — one step below the ground.
- **Label Plane** (`--surface`): Cards, panels, dropdown menus — the sheet a record is printed on.
- **Raised Stock** (`--surface-2`): Badges, hover fills on menu rows and ghost/secondary buttons, avatar wells.
- **Card Stock** (`--card`): The empty state of a poster tile before art loads.
- **Rule Line** (`--border`) / **Rule Line High** (`--border-hi`): Hairlines and structural rules. The high variant marks a real division (topbar bottom edge, panel outline, perforation dots); the base variant marks an internal one.
- **Label Ink** (`--content`): Primary type. Warm off-white, never pure white — a gummed label is paper.
- **Muted Ink** (`--muted`) and **Faint Ink** (`--muted-2`): Secondary and tertiary type; both hold body-legible contrast on the ground (~6.9:1 and ~4.9:1).
- **Reverse Ink** (`--ink`): Type set on an amber field.

### Named Rules

**The Neutral Ground Rule.** The ground stays near-neutral. Any hue pushed into `--bg`, `--surface`, or `--card` falsifies every poster on the screen at once. Tinting the ground to match a title's artwork is not permitted.

**The One Job Rule.** Each ink has exactly one meaning: amber is yours, verdigris is the system's, red is affection. A verdigris "like" or a red "watched" is a bug, not a variation.

**The Ink Is Rare Rule.** Colour is spent on marks and state, never on decoration. On a browse grid the only coloured pixels the app itself contributes are rating badges and heart marks; everything else is artwork and graphite.

## Typography

**Display / Label Font:** Archivo Variable (with system-ui, Arial Narrow), used at width axis 79% for the condensed cut
**Body Font:** Archivo Variable (with system-ui, -apple-system, Segoe UI, Arial)
**Data Font:** Courier Prime (with Courier New, ui-monospace), tabular figures on

**Character:** One superfamily runs the whole interface, and its width axis — not merely its weight — supplies the stencil-cut label voice. Against it, Courier Prime reads unmistakably as machine output. The pairing is a filing system: a stamped label and the typewriter that filled it in.

### Hierarchy
- **Display** (800, 2.25rem→3rem, line-height 0.95, tight tracking, condensed, uppercase): Media titles on the detail page. The only place type is allowed to be large.
- **Headline** (800, 1.125rem / 15px, condensed, uppercase, 0.04–0.06em): Empty-state headings and list-card titles.
- **Title / Shelf Label** (800, 13px, condensed, uppercase, 0.16em): Section headers, always sitting directly above a perforated rule.
- **Label** (700, 11–13px, condensed, uppercase, 0.08–0.18em): Navigation, tabs, buttons, badges, stamps, type classifications, and micro-headings on panels ("Your record", "Your rating"). This is the most-used voice in the app by a wide margin.
- **Body** (400, 0.875rem, line-height 1.625): Overviews, reviews, descriptions, member names. Prose is capped at 62ch on the detail page.
- **Data** (400/700, 11–13px, tabular): Accession lines, counts, tallies, runtimes, dates, rating values, list sizes. Steps up to 1.5rem/700 for a community rating average — the one place a number is a headline.

### Named Rules

**The Typewriter Rule.** If a value came out of the system rather than out of a person — a code, a date, a count, a runtime, a rating — it is set in Courier Prime with tabular figures. Prose is never typewritten and counts are never set in the label face.

**The Condensed Caps Rule.** Every heading, nav item, tab, button, badge, and stamp uses the condensed width axis in uppercase with open tracking (≥0.08em). Sentence-case UI chrome does not exist in this world.

**The Self-Hosted Type Rule.** Fonts are bundled and served by the app itself via fontsource. A runtime CDN font is prohibited: an instance with no outbound internet would silently drop the entire interface back to system fallbacks and lose the width axis that carries the world.

## Layout

A single centred column of `max-w-6xl` (72rem) with `16px` gutters that open to `24px` from the small breakpoint, applied identically across every page. The topbar is sticky, 64px tall on phones and 80px from the small breakpoint, and separated from the page by a 2px high-contrast rule rather than a shadow.

The flagship record surface (media detail) is a three-column grid at large widths — `230px` poster rail, fluid main column, `260px` ledger rail — collapsing to a single stack below, where the record card moves alongside the poster instead of under it. The right rail sticks below the topbar.

Browse surfaces are dense caption-less poster grids: 3 columns on phones, 4 at small, 6 at medium, 8 at large, with `10px` column gaps and `16px` row gaps. Horizontal rails use the same `10px` rhythm with an edge-fade mask and hidden scrollbars. Every poster keeps a 2:3 aspect ratio.

Spacing rhythm is a compact 4px-based ladder concentrated at `8px` and `12px` for inline gaps, `16px` for related blocks, `24px`/`32px` between panels, and `48px` between major page bands. Inputs stand at 44px and buttons at 32/40/44px, so touch targets stay one-hand usable on a phone. Inputs are forced to 16px type below 640px to stop iOS Safari's focus auto-zoom.

## Elevation & Depth

This system is flat and depth is conveyed by tonal layering and ruling, not by lift. There are exactly two shadows, both real offset-and-blur drop shadows in pure black with no coloured halo, and both are ambient rather than structural — they attach the flagship poster and two floating elements to the page, and are absent from every card, panel, tile, and button in the app. Layers are read from the graphite ladder instead: shelf shadow below the ground, ground, label plane, raised stock. Hairline rules do the rest of the work, with the perforated sprocket rule reserved for major section breaks. A fixed 5%-opacity fractal-noise overlay in `overlay` blend mode sits above everything, giving flat fields the tooth of printed stock so they never read as glass.

### Shadow Vocabulary
- **Soft** (`box-shadow: 0 10px 24px -14px rgb(0 0 0 / 0.85)`): The detail-page poster and the account dropdown — an object resting on the page.
- **Lift** (`box-shadow: 0 16px 34px -18px rgb(0 0 0 / 0.9)`): The floating mobile log button only.

### Named Rules

**The No Glow Rule.** There is no coloured shadow, no `box-shadow` with a hue, no halo, and no bloom anywhere in this system. State is shown by struck ink, a ring, or a rule — never by light.

**The Flat Surface Rule.** Cards, panels, tiles, badges, and buttons carry no shadow at rest and gain none on hover. Hover changes ink, border, or ring; it does not raise the object.

## Shapes

Labels are cut rectangles. The radius scale was redefined outright so that the entire existing codebase resolves to label corners: `rounded-sm` is 1px, the default and `rounded-md` are 2px, `rounded-lg` and `rounded-xl` are 3px, `rounded-2xl` is 4px, and `rounded-3xl` is 5px. Every legacy `rounded-xl`/`rounded-2xl` call site therefore renders as a cut corner rather than a soft card, and the world holds across a hundred call sites without editing each one. Fully round geometry (`rounded-full`) is reserved for objects that are genuinely circular: avatars, status pips, the spinner, and small round icon buttons overlaid on artwork.

Borders are the primary structural device — 1px hairlines for internal divisions, 2px for a real edge (topbar bottom, active tab and nav underlines, mobile drawer's active left rule). Empty states use a dashed rule to read as an unfilled form. The archive's own divider is the perforated sprocket rule: a 7px-tall repeating radial-gradient of 1.6px dots on a 13px pitch, used under every section header.

Two recurring silhouettes define the system: the 2:3 poster tile with a 1px ring that thickens to a 2px amber ring on hover or focus, and the stamp — a 1.5px outlined block of condensed caps rotated -1.6°, which is the tilt that makes it read as struck by hand rather than printed.

## Components

### Buttons
- **Shape:** Cut corners (1px), fixed heights of 32 / 40 / 44px, condensed bold uppercase with 0.09em tracking.
- **Primary:** Flat acetate-amber field with dark reverse type and a matching amber border. No gradient, no shadow.
- **Hover / Focus:** Primary drops to 90% amber. Focus is a 2px amber ring offset 2px against the ground; disabled drops to 45% opacity with pointer events off. Colour transitions run at 110ms ease, globally, on every link and button.
- **Secondary:** Transparent field with a high-contrast rule; hover brightens the rule to full ink and fills with raised stock.
- **Ghost:** Transparent and borderless with muted type; hover fills with raised stock and brightens type.
- **Danger:** Transparent with a half-strength stamp-red rule and red type; hover fills 10% red and solidifies the rule.

### Cards / Containers
- **Corner Style:** Cut (1px).
- **Background:** Label plane on the page ground; shelf shadow for wells and image beds inside a card.
- **Shadow Strategy:** None. See Elevation & Depth.
- **Border:** 1px rule line; the record card and dropdown use the high-contrast rule; empty states use a dashed high-contrast rule.
- **Internal Padding:** 12px on tiles, 12–16px per band on segmented panels, with each band separated by a full-width 1px rule rather than by whitespace.

### Inputs / Fields
- **Style:** 44px tall, shelf-shadow well, 1px rule line, 1px cut corner, 12px horizontal padding, body-size ink with faint-ink placeholders.
- **Focus:** Border shifts to amber with a matching 1px amber ring. No glow, no shadow.
- **Search field (topbar):** A ruled box with an inline glyph whose border shifts to amber on focus-within.

### Navigation
- **Style:** Condensed bold uppercase at 13px with 0.14em tracking, laid horizontally in the sticky topbar with a 2px bottom rule under the active item in amber and muted ink for the rest. Hover brightens to full ink; nothing moves.
- **Mobile:** Below the medium breakpoint the same items drop into a drawer under the topbar, where the active marker rotates to a 2px left rule and the row grows to a 44px-class touch target. The desktop "+ Log" button is replaced by a fixed 56px square amber button at the bottom right — the one element in the app that carries the lift shadow.

### Tabs
- **Style:** Condensed bold uppercase at 12px in a horizontally scrollable strip with a hidden scrollbar over a 1px baseline rule. The active tab is ruled in amber (2px); inactive tabs carry a transparent rule and muted ink.
- **Counts:** Set in Courier Prime at 11px in faint ink with tracking reset to normal — a tally, not part of the label.

### Poster Tile (signature)
The workhorse of every browse surface. A flat 2:3 tile with a 1px 60%-opacity high rule ring that becomes a 2px amber ring on hover or focus. The artwork is the content, so the tile adds no lift, no scrim, and no gradient over it. Classification sits flush in the top-left corner as a 9.5px condensed caps chip on a 90%-opacity shelf-shadow field; the viewer's own marks sit flush in the top-right — a stamp-red heart and, on a solid amber field, the rating typed in Courier Prime. Corners are square where the badge meets the tile edge, so the marks read as applied to the artwork rather than floating above it. When there is no artwork, the tile falls back to a title-seeded gradient with the title set in condensed caps at the foot.

### Stamp (signature)
The state mark. A 1.5px outlined block of 11px condensed extra-bold caps at 0.1em tracking, rotated -1.6°, in amber, verdigris, stamp red, or faint ink. Unset states render in faint ink at 55% opacity — an empty ruled box waiting to be filled. Setting one plays the single authored motion in the app (see Do's and Don'ts). Used for WATCHED, LIKED, WATCHLIST and any other "this is now true of this title" mark.

### Accession Line (signature)
A title's provider coordinates typewritten beneath it — `tmdb·550 · 1999 · 139m` in 11px Courier Prime, faint ink, joined by spaced middots. This is the detail that makes a screen read as a catalogue record rather than a storefront, and it is genuinely useful: it is the id you would search the provider for.

### Ledger (signature)
Label left, count typed right, a dotted leader stretching between them. Used for the "On Cinelog" stats block. Distributions are drawn as flat amber bars with a 3px baseline tick for empty buckets — a printed tally, never a chart widget with a gradient.

## Do's and Don'ts

### Do:
- **Do** keep the ground near-neutral graphite so poster artwork reads true.
- **Do** set every machine-produced value — codes, dates, counts, runtimes, ratings — in Courier Prime with tabular figures.
- **Do** use the condensed width axis in uppercase for all headings, nav, tabs, buttons, badges, and stamps.
- **Do** show state as a struck stamp: outlined, tilted -1.6°, in the ink that owns that meaning.
- **Do** put a perforated sprocket rule under section headers; that is this world's divider.
- **Do** keep the rating badge in the top-right corner of a poster tile on every grid — Library, Watchlist, Watched, and profile grids all follow it.
- **Do** convey depth with the graphite tonal ladder and hairline rules.
- **Do** self-host every font and asset; an instance may have no outbound internet.
- **Do** keep prose to about 62ch and body type at 0.875rem with relaxed leading.

### Don't:
- **Don't** add glow: no coloured shadow, no halo, no bloom, no lit chips. State is struck, never illuminated.
- **Don't** use blur as a surface material or decoration. The only blur in the system is the veil behind a modal (a black 70% scrim with a light blur), which is a dimming device, not a pane.
- **Don't** fill a control, card, panel, badge, or chart bar with a gradient. Gradients appear only as photographic scrims fading artwork into the ground, and as the seeded placeholder behind a missing poster.
- **Don't** raise a surface on hover or attach a shadow to a card, tile, panel, or button. Hover changes ink, border, or ring.
- **Don't** reach past 5px of corner radius on a surface or control. Fully round is only for genuinely circular objects — avatars, pips, spinners, round icon buttons over artwork.
- **Don't** scatter entrance animation. No staggered fade-ups, no per-tile delays, no ken-burns pans, no pulsing accents.
- **Don't** add a second authored motion. The stamp strike is the only one: 260ms on `cubic-bezier(0.2, 0.9, 0.3, 1)`, scaling 1.45 → 0.93 → 1 at a fixed -1.6° tilt, played only on a press the user just made and never on first paint, and disabled entirely under `prefers-reduced-motion`. Loading feedback (the border spinner, skeleton pulse, colour transitions at 110ms) is chrome, not authored motion, and does not count against this.
- **Don't** repurpose an ink. Amber is the user's own marks, verdigris is the system, stamp red is affection.
- **Don't** put a scrim or overlay across poster artwork on a browse tile; the marks sit flush in the corners and the art stays intact.
