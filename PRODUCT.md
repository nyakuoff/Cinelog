# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A single self-hosted instance run by its owner for themselves and a small group of
invited friends. Everyone on an instance is a known person, not a stranger who
wandered in — there is no public signup funnel to design for, and no cold-visitor
first impression to win. The daily job is logging what you just watched and seeing
what the handful of people you follow have been watching.

## Product Purpose

Track and review everything you watch, and see what your friends are watching.
Cinelog is a companion app — it never plays media, it only records and discusses it.
Success is that logging a watch is fast enough to actually do every time, and that
the feed is worth opening when you have nothing specific to log.

## Positioning

Letterboxd's experience, self-hosted, extended past film. The owner's own framing:
"a Letterboxd clone, honestly" — deliberately not over-differentiated in function.
Two things are genuinely different and worth designing around:

- **Every kind of visual media is first-class.** Film, TV, anime, cartoons,
  documentaries, miniseries, and specials, with per-episode tracking and ratings.
  The rating scale itself adapts to media type. "Films" is too narrow a word for
  what this holds — the primary nav says Media for that reason.
- **You own it.** Your server, your SQLite file, full JSON export, no algorithmic
  ranking, no ads, no lock-in.

## Operating Context

- Logged from a phone as often as from a desktop, typically right after watching.
- Metadata (titles, artwork, cast, episodes) comes from TMDB via a pluggable
  provider layer; artwork is proxied and cached locally, never hotlinked.
- Many libraries arrive by bulk import from a real Letterboxd export (CSV) rather
  than being typed in from scratch, so the app is frequently first seen already
  full of hundreds of titles and years of backdated history.
- Deployed with Docker Compose; upgrades run migrations automatically.

## Capabilities and Constraints

Confirmed functionality: ratings, watch history (diary), watchlist, per-title
status and rewatch counts, text reviews with spoiler concealment, likes and
comments, follows, symmetric blocking, an activity feed with time-windowed
grouping, ordered lists with per-entry notes, public profiles with separately
ranked favorite films and shows, faceted media browse, and Letterboxd CSV import
plus live diary sync.

Constraints:

- React + Vite + Tailwind, NestJS + Prisma + SQLite, shared Zod contracts.
- Design tokens are CSS custom properties consumed through Tailwind, so a light
  theme stays possible later.
- Self-hosted instances may have no outbound internet and should not depend on
  third-party CDNs at runtime — fonts and assets must be served by the app itself.
- Privacy (public / followers-only / private) is enforced server-side, never only
  hidden in the UI.

Not yet built, and must not be implied as working: notifications and moderation
tooling (tables exist, no endpoints or UI), and unified search across members and
lists (search covers titles only).

## Brand Commitments

- Name: **Cinelog**. Wordmark sets "Cine" in the body color and "log" in the
  accent.
- Mark: three overlapping flat dots in the palette order gold / cyan / rose.
- Existing palette is broadly right and should be adapted rather than discarded:
  gold `#ffb13c` (primary), cyan `#45d0dd` (secondary), rose `#ff5d7a`
  (affection/likes), on an indigo-plum night ground.
- The interface must have a distinct visual character of its own. Copying
  Letterboxd's *layout and information architecture* is explicitly wanted;
  copying its *visual identity* is explicitly not.

## Evidence on Hand

- Real running instance with a real library, live TMDB artwork, and genuine
  watch history — screenshots and testing use real data, never lorem or invented
  titles.
- No testimonials, user counts, press, pricing, or case studies exist. None may
  be fabricated; there is nothing to market with, and nothing to market to.

## Product Principles

1. **Logging is the product.** The path from "just finished something" to "it's
   recorded" stays the shortest path in the app.
2. **Everything watched counts.** A rating with no diary entry, an imported
   backlog, a show marked complete — all are real history and must surface
   everywhere history is shown.
3. **Not just films.** Any surface that only makes sense for movies is a bug.
4. **The server decides what you can see.** Privacy and visibility are enforced
   in the API; the UI never hides something the API would still hand over.
5. **Owned, not rented.** No runtime dependency on a third party the instance
   owner doesn't control.

## Accessibility & Inclusion

No product-specific standard has been established. General baseline applies:
readable contrast on the dark ground, real focus states, and touch targets that
work one-handed on a phone.
