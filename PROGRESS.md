# Cinelog Social Upgrade — Progress

Tracks the multi-session upgrade from a private rating tool into a Letterboxd-style social
discovery platform. See the approved plan for full context and rationale.

## Completed

### Slice 1 — Schema foundation (2026-07-27)

- Added `displayName`, `profileVisibility`, `watchlistVisibility` to `User`.
- Added `favoritePosition` (1–4, unique per user) to `UserMediaStatus` — this is how the
  "4 favorite titles" feature is implemented, reusing the existing tracking table instead of
  a new one.
- New models: `Review`, `ReviewLike`, `ReviewComment`, `Follow`, `UserBlock`, `List`,
  `ListItem`, `ListLike`, `ListComment`, `ActivityEvent`, `Notification`, `ContentReport`,
  `ModerationAction`.
- New Zod enums in `packages/contracts/src/enums.ts`: `ProfileVisibility`, `ActivityType`,
  `NotificationType`, `ReportTargetType`, `ReportStatus`.
- Migration: `apps/api/prisma/migrations/20260727000000_social_foundation/migration.sql`
  (additive only — one `ALTER TABLE ADD COLUMN`, several `CREATE TABLE`, and a SQLite-required
  table-rebuild of `users` to add the three new nullable/defaulted columns, which preserves all
  existing rows via `INSERT INTO new_users SELECT ... FROM users`).
- `apps/api/src/backup/backup.service.ts` + `packages/contracts/src/backup.ts` extended to
  export/import `favoritePosition` and a media review per `BackupItem`. Old backups (missing
  these fields) still parse via Zod `.optional().default(...)`.

**Verification run:**
- `pnpm --filter @cinelog/contracts build` — pass
- `pnpm --filter @cinelog/api typecheck` — pass
- `pnpm --filter @cinelog/api test` — 2 suites / 7 tests pass
- Applied migration against the real dev DB (`apps/api/data/cinelog.db`) via
  `prisma migrate deploy` (non-interactive `migrate dev` isn't supported in this environment,
  so the migration SQL was generated with `prisma migrate diff --script` and committed as a
  normal migration directory, then applied with `deploy`). Confirmed via `sqlite3`: existing
  user/rating/status rows are untouched after migration; new `reviews` table exists and is
  empty.

### Slice 2 — Nav rework + public profiles & favorites (2026-07-27)

- API: new `apps/api/src/profiles/` module — `GET /users/:username` (public, visibility-aware:
  PUBLIC/FOLLOWERS/PRIVATE checked server-side; a `FOLLOWERS`-gated profile requires an
  accepted `Follow` row; watchlist visibility is gated independently and never wider than
  profile visibility) and `PATCH /users/me/favorites` (sets `favoritePosition` 1–4
  transactionally, rejects duplicates/unknown ids).
- `JwtAuthGuard` now optionally decodes a Bearer token on `@Public()` routes (attaches
  `request.user` if present and valid, otherwise proceeds anonymously) so the profile endpoint
  can tell "anonymous visitor" from "signed-in visitor" for follower-only visibility, without
  requiring auth on a public route.
- `UserPublic` contract gained `displayName`/`profileVisibility`/`watchlistVisibility`;
  `UpdateProfileRequest` accepts editing them.
- Frontend: `/profile` and new `/u/:username` now render `PublicProfilePage` (self mode when no
  `:username` param — falls back to the signed-in user). Settings (avatar/banner/bio/username/
  email/password + the new privacy selects) moved to `/settings`
  (`apps/web/src/pages/SettingsPage.tsx`, renamed from the old `ProfilePage.tsx`). Nav
  (`Layout.tsx`) gained a "Profile" tab; the dropdown menu gained "Settings".
  `FavoritesEditorModal.tsx` lets the owner pick up to 4 titles from their library and
  drag-and-drop reorder them (native HTML5 DnD, no new dependency).
- Tests: `apps/api/src/profiles/profiles.service.spec.ts` — PUBLIC always visible,
  PRIVATE hidden from everyone but the owner (and leaks no bio), FOLLOWERS visible only to an
  accepted follower, watchlist visibility never exceeds profile visibility.

**Verification run:**
- `pnpm --filter @cinelog/contracts build`, `pnpm --filter @cinelog/api typecheck`,
  `pnpm --filter @cinelog/api test` (11/11), `pnpm --filter @cinelog/web build` — all pass.
- Booted the real API against the migrated dev DB and hit `GET /api/users/nyaku` — returned a
  full profile payload; `GET /api/users/doesnotexist` returned 404 as expected.

### Slice 3 — Discover page replaces home (2026-07-27)

- API: new `apps/api/src/discovery/` module. `GET /discovery` (public) returns provider-sourced
  rails (Trending movies/shows, Popular, New & upcoming — via a new optional
  `MetadataProvider.getDiscoverList()` hook, implemented for TMDB using
  `/trending/*/week`, `/*/popular`, `/movie/upcoming`, `/tv/on_the_air`) plus Cinelog-community
  rails (Highly rated, Hidden gems — Prisma `groupBy` on `Rating` with `having` thresholds:
  highly rated needs ≥2 ratings; hidden gems needs 1–3 ratings averaging ≥80). Every section is
  tagged `source: 'PROVIDER' | 'CINELOG'` so the UI can visually distinguish them, and empty
  sections (TMDB not configured, or not enough community data yet) are dropped server-side
  rather than rendered as dead rails. `GET /discovery/filter` does local type/genre/decade/
  min-rating filtering with community-rating/rating-count/release-date/popularity sort and
  offset-cursor pagination.
- `ProviderRegistry.getDiscoverList()` swallows a failing/unconfigured provider and returns
  `[]` rather than throwing, so one bad provider never breaks the whole Discover page.
- Frontend: `/` now renders `DiscoverPage.tsx` (filter bar + horizontal poster rails, reusing
  `PosterCard`). The former home page (personal library grid with Films/Shows tabs) survives
  unchanged at the new `/library` route (`apps/web/src/pages/LibraryPage.tsx`, renamed from
  `HomePage.tsx`) — existing functionality preserved, not deleted. Nav gained a "Library" tab;
  "Home" relabeled to "Discover".

**Verification run:**
- `pnpm --filter @cinelog/contracts build`, `pnpm --filter @cinelog/api typecheck`,
  `pnpm --filter @cinelog/api test` (11/11), `pnpm --filter @cinelog/web build` — all pass.
- Booted the real API with TMDB configured: `GET /api/discovery` returned live trending/
  popular/upcoming rails (18 items each) sourced from TMDB; `HIGHLY_RATED`/`HIDDEN_GEMS` were
  correctly absent (not enough local ratings yet — confirms empty-section dropping works).
  `GET /api/discovery/filter?sort=CINELOG_RATING` returned a locally-filtered result; an
  invalid `sort` value correctly 400s via the Zod query DTO.

### Slice 4 — Reviews, likes, comments (2026-07-27)

- API: new `apps/api/src/reviews/` module: `POST/GET /media/:id/reviews`, `GET/PATCH/DELETE
  /reviews/:id`, `POST/DELETE /reviews/:id/like`, `GET/POST /reviews/:id/comments`,
  `PATCH/DELETE /reviews/:reviewId/comments/:commentId`. One review per user per title
  (`[userId, mediaItemId, targetType]` unique, reusing the `Review` model from slice 1).
  `likeCount`/`commentCount` are denormalized on `Review` and updated transactionally
  alongside the like/comment row.
- Spoiler handling: list responses conceal the body (`concealed: true`, `body: ''`) for anyone
  but the author; `GET /reviews/:id` (an explicit open) always reveals it. Body is always
  rendered as plain text client-side (`whitespace-pre-wrap`, no `dangerouslySetInnerHTML`) —
  never raw HTML.
- Duplicate likes: `ReviewLike` has a DB-level unique constraint on `[userId, reviewId]`; the
  service catches the resulting `P2002` and treats a repeat like as a no-op rather than an
  error (verified live — see below).
- Sorting: `POPULAR`/`RECENT`/`HIGHEST`/`LOWEST`/`FOLLOWING` (the latter needs `Follow` data
  from slice 6 to return anything — correctly returns empty until then, not fake data).
  Pagination is offset-based (`cursor` is a stringified offset), matching the pattern already
  used by `discovery.filter`.
- Frontend: `ReviewsSection.tsx` embedded on `MediaDetailPage` — composer (one review per user,
  switches to "edit" after posting), sort select, per-review like (optimistic update with
  rollback on failure) and expandable comments.
- Tests: `apps/api/src/reviews/reviews.service.spec.ts` — spoiler concealment for
  stranger/author, `getById` always reveals, edit/delete restricted to the author, duplicate
  like is a no-op, comment edit/delete restricted to the comment author.

**Verification run:**
- `pnpm --filter @cinelog/contracts build`, `pnpm --filter @cinelog/api typecheck`,
  `pnpm --filter @cinelog/api test` (16/16), `pnpm --filter @cinelog/web build` — all pass.
- Live smoke test against the real API + dev DB with two throwaway accounts: posted a
  spoiler review as user A (rating 90) → listed as user B and confirmed `concealed: true` /
  empty body → liked (204) and commented as user B → confirmed `likeCount`/`commentCount`
  denormalized to 1/1 in the DB → user B's delete attempt on A's review correctly 403'd → a
  second review by A on the same title correctly 409'd → author's own list view correctly
  shows `concealed: false` with the full body. Test accounts removed afterward.

### Slice 5 — Watchlist/diary profile surfacing (2026-07-27)

- API: `GET /users/:username/diary` and `GET /users/:username/watchlist` on the profiles
  module, reusing the same `resolveAccess()` privacy logic from slice 2 (diary gated by
  `canView`, watchlist independently by `canViewWatchlist` — refactored the duplicated
  visibility logic out of `getPublicProfile` into a shared private helper). Both return an
  empty list rather than an error when access is denied, so the frontend never has to special-
  case a 403 mid-render.
  `PATCH/DELETE /tracking/watch/:id` added for diary entry correction/removal (previously only
  create existed) — owner-only, a mismatched or missing entry both 404 (not 403) to avoid
  confirming an entry's existence to a non-owner.
- Frontend: `PublicProfilePage` gained an Overview/Diary/Watchlist tab bar (Watchlist tab only
  rendered when `canViewWatchlist`); the diary tab shows a "Remove" action on the owner's own
  profile.

**Verification run:**
- `pnpm --filter @cinelog/contracts build`, `pnpm --filter @cinelog/api typecheck`,
  `pnpm --filter @cinelog/api test` (17/17), `pnpm --filter @cinelog/web build` — all pass.
- Live smoke test: `GET /api/users/nyaku/diary` and `/watchlist` both return empty lists
  gracefully (no diary/watchlist data yet, no crash); `GET /api/users/doesnotexist/diary` and
  `/watchlist` both correctly 404.

### Slice 5b — Letterboxd layout fidelity pass (2026-07-27)

User feedback: the layout wasn't a close enough match to Letterboxd's actual page structure.
Reworked three surfaces to mirror it more precisely (IA/structure only — colors, type, copy,
and branding stay Cinelog's own, per the plan's layout-fidelity note):

- **Media detail page**: the primary actions (watched/like/watchlist) moved out of a vertical
  sidebar card into a horizontal icon row directly under the poster (Letterboxd's signature
  placement); the rating widget and status picker now sit right below that, also under the
  poster, not in the sidebar. The community rating — big average number + a 10-bucket
  histogram — now appears immediately after the title block (the first thing after the header
  on a real Letterboxd film page), not buried at the bottom of a sidebar card. New API surface
  for this: `MediaDetail.ratingCount`/`ratingDistribution` (`apps/api/src/media/media.service.ts`
  `getDetail()`), computed the same way as the existing profile-level histogram.
- **Public profile page**: the header backdrop is now a 4-up collage built from the member's
  own favorite posters (falling back to a gradient tile per empty slot) instead of a single
  uploaded banner image — Letterboxd builds its header from the account's own activity, not a
  separate asset. Follower/following counts moved into the stats row (Films/Shows/Episodes/
  Ratings/Followers/Following) instead of sitting as plain text under the bio. Added a
  **Reviews** tab (new `GET /users/:username/reviews`, `ReviewsService.listByAuthor()`,
  gated by the same profile-visibility check as the other tabs).
- **Nav**: clicking the avatar now navigates directly to `/profile` (Letterboxd behavior); a
  separate small caret button opens the settings/logout dropdown, rather than the avatar click
  being overloaded as the only way to reach both.
- **Bug fix while wiring the profile Reviews tab**: spoiler "reveal" in both `ReviewsSection`
  (media page) and the new profile Reviews tab was only flipping a local boolean — since the
  list endpoint always sends `body: ''` for concealed reviews, revealing showed nothing. Fixed
  both to fetch the full body via `GET /reviews/:id` (which always reveals) on click.

**Verification run:**
- `pnpm --filter @cinelog/contracts build`, `pnpm --filter @cinelog/api typecheck`,
  `pnpm --filter @cinelog/api test` (17/17), `pnpm --filter @cinelog/web build` — all pass.
- Live smoke test: posted a review via a throwaway account, confirmed `GET /api/media/:id`
  returns `ratingCount`/`ratingDistribution`, and `GET /api/users/layouttester/reviews` returns
  the review with its embedded media summary. Test account removed afterward.

### Slice 6 — Letterboxd structural parity (2026-07-27)

Direction from the user: match Letterboxd's layout, UI, and feature set closely, keeping
only Cinelog's colours and identity. Layout/IA and feature parity are copied; branding,
logo, and copy stay Cinelog's own (their source isn't available to copy verbatim anyway).

**Shared layout grammar** — `apps/web/src/components/lb.tsx`: dense caption-less poster
grids, ruled uppercase section headers with trailing links, underline tab bars, inline
★★★★½ star text, empty states. Every browse surface is built from these.

**Nav** restructured to Home / Films / Lists / Members / Library / Watchlist with a
`+ Log` button and the username beside the avatar (avatar → profile, caret → menu).

**Films browse page** (`/films`) — the signature Letterboxd surface, previously missing.
Backed by a new `GET /discovery/browse` over TMDB `/discover`, so the grid is populated on
a fresh install instead of showing only locally cached titles. Filters: type, genre,
decade, min rating, sort, plus a "Cinelog only" toggle. A genre unsupported for the
selected type returns empty rather than silently dropping the filter. New provider seam:
`MetadataProvider.browse()` + `getSimilar()`.

**Film page** rebuilt on the three-column structure: poster + action panel (watched /
like / watchlist, rating, status, "Review or log") in the left column; title, director,
synopsis and Cast/Crew/Details/Genres tabs in the middle; ratings histogram and community
stats in the right rail; reviews and similar films below. Added
`MediaDetail.ratingCount / ratingDistribution / watchedCount / likedCount / reviewCount`
(watched counts *distinct* members so rewatches don't inflate it) and
`GET /media/:id/similar`.

**Social graph** — `apps/api/src/social/`: follows, blocking, members directory, activity
feed. Activity is recorded inline from the rate/review/watch/like/list write paths and
retracted when the action is undone. The feed groups same-actor same-type events inside an
hour into one row. Private profiles are excluded from the directory and instance-wide feed.

**Lists** — `apps/api/src/lists/`: ordered entries, per-entry notes, public/private,
likes, comments. Reorder rewrites the whole order in one transaction and rejects any set
that doesn't cover every entry exactly once. Duplicate titles rejected by the unique
constraint with a clear message.

**Log modal** — the `+ Log` flow: pick a title, set watched date/rewatch, rate, like, and
review in one pass. Prefills existing rating/like, and detects an existing own review so a
repeat log edits rather than hitting the one-review-per-title constraint.

**Bugs found and fixed during this slice:**
- Spoiler "reveal" only flipped local state, but the list endpoint sends an empty body for
  concealed reviews — revealing showed nothing. Both reveal paths now refetch via
  `GET /reviews/:id`.
- Blocking severed the follow but left the `FOLLOWED` activity event, so a dissolved
  relationship kept advertising itself (and the blocked person's name) in other members'
  feeds. Block now retracts those events in both directions, transactionally.
- Making a list private left its activity events pointing at content the viewer could no
  longer open. Now retracted on going private, and on delete.

**Verification run:**
- `pnpm --filter @cinelog/contracts build`, `pnpm --filter @cinelog/api typecheck`,
  `pnpm --filter @cinelog/api test` (35/35 across 6 suites), `pnpm --filter @cinelog/web build`
  — all pass.
- Live API smoke tests with throwaway accounts, all cleaned up afterwards via Prisma:
  - Browse: default popular films, Horror/1980s/highest-rated (returned canonical 80s
    horror), TV browse, unsupported-genre-for-type → empty, invalid sort → 400.
  - Similar titles for a show returned relevant neighbours.
  - Follows: follow, repeat-follow no-op, self-follow → 400, feed shows followee activity,
    non-follower's feed empty.
  - Blocking: feed and members list excluded in both directions, follow-while-blocked →
    400, uninvolved third party unaffected, `FOLLOWED` events retracted (2 → 0).
  - Private profile hidden from members directory for others and anonymous, still visible
    to its owner.
  - Lists: create, add, duplicate → clear 400, cross-user edit/delete → 403, like
    idempotent, comment, reverse reorder, partial reorder → 400, going private removes it
    from browse / other users' profile view / anonymous access (404) while the owner keeps
    200, and retracts its activity events.
  - Log flow: watch + rate + like + review produced correct counts, a backdated diary
    entry, and own-review detection.
- **Cascade check**: verified that deleting a user through Prisma correctly cascades to
  reviews and comments. (An earlier cleanup left orphans because the `sqlite3` CLI has
  `PRAGMA foreign_keys` **off** by default — an artifact of the test cleanup, not the
  schema. Test cleanup now goes through Prisma.)

### People (filmographies)

- `GET /people/:id` and `GET /people/by-name?name=` return a person and everything they
  worked on, read straight from the metadata provider — nothing about a person is stored
  locally, because there is no user data to hang off one. Each credit is matched against the
  cache so an already-known title opens directly instead of being re-resolved.
- Credits now carry the provider's `personId`, so a director or cast name on a film page
  links to `/person/:id`. Credits **cached before this change** (and admin-entered cast) have
  no id and route through `/person/name/:name` instead, which costs one extra provider search
  on click. Cached details are never refreshed on a timer, so existing titles keep using the
  name path until they're rematched — the fallback is the design, not a stopgap.
- Verified live: Christopher Nolan by id (46 acting / 33 crew credits, multi-role credits
  merged into one entry, newest first, cached titles flagged), Greta Gerwig by name, a
  nonsense name → 404, unauthenticated → 401, and a freshly fetched title carrying person ids
  on every credit.

## Not yet started

- **Notifications** — `Notification` table exists from slice 1; no endpoints or UI yet.
  Should be generated from the same write paths that already record activity (follow,
  review like, review comment, list like, list comment), deduped before insert, and never
  fired for self-interaction.
- **Moderation** — `ContentReport` / `ModerationAction` tables exist from slice 1; no
  endpoints or UI yet. Needs a report action on reviews/comments/lists/profiles, an admin
  queue, and hide/remove actions with an audit trail.
- **Unified search** — search currently covers titles only. Extending it to members and
  lists needs the same privacy filters already used elsewhere (no private profiles or
  lists in results). Recent searches stored client-side.
- **"Lists containing this title"** on the film page — the query is straightforward
  (`ListItem` by `mediaItemId`, filtered to public lists); just not wired up yet.
- **Episode-level tracking** — currently only episode *ratings* exist; there's no separate
  "watched" flag per episode, which is why profile stats count rated episodes as a proxy.

## Known limitations / decisions

- Backup/restore does not yet cover `Follow`, `List`, or `ReviewLike`/`ReviewComment` — only
  per-media favorites and the review body/rating are round-tripped. Follows/lists are
  cross-user relations that need more thought (e.g. a followed username may not exist on the
  target install) — deferred to when the Lists/Follow slices land.
- `favoritePosition` restore skips a slot if it's already occupied by a different title on the
  target account, rather than overwriting — avoids surprising data loss on merge-import.
- Lint is unconfigured in both apps (pre-existing; `pnpm lint` is a no-op). Not addressed in
  this slice — flagging for a future slice if the team wants ESLint added.
- `PublicProfile.stats.episodesWatched` counts rated episodes (`EpisodeRating` rows) as a proxy
  — the schema has no separate "episode watched without rating" flag. `moviesWatched`/
  `showsWatched` are distinct-media counts from `WatchHistory`, split by `MediaType` (MOVIE vs.
  everything episodic — TV/ANIME/CARTOON/MINISERIES/SPECIAL; DOCUMENTARY counts as a movie).
- Admins have no special ability to view PRIVATE profiles in this slice — out of scope for now,
  revisit if moderation needs it.
- Backup/restore still covers only per-media favourites and the review body/rating. Lists,
  follows, and review likes/comments are **not** round-tripped — they're cross-user
  relations whose counterparties may not exist on the target install. Worth solving before
  anyone relies on backup as a full migration path.
- Pagination is offset-based (`cursor` is a stringified offset) rather than keyset. Fine at
  self-hosted scale; would drift under heavy concurrent writes.
- `Discover`'s "hidden gems" and "highly rated" rails need at least a few ratings on the
  instance before they appear at all — by design, but it means a fresh install shows only
  provider-sourced rails.
- The Films page browses TMDB directly, so its result set isn't restricted to types Cinelog
  models separately (anime/cartoon/etc. surface as movie or TV, matching TMDB's taxonomy).
- Lint is still unconfigured in both apps (`pnpm lint` is a no-op) — pre-existing.
