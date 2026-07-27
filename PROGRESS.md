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

## Not yet started

- Slice 3: Discover page (community + provider-sourced sections, filters, personalization) —
  will also relabel the "Home" nav tab to "Discover" once its content actually changes.
- Slice 4: Reviews/likes/comments API + UI on `MediaDetailPage`.
- Slice 5: Watchlist/diary surfaced on profile + diary edit/delete endpoints.
- Slice 6: Follow graph, blocking, activity feed.
- Slice 7: Lists.
- Slice 8: User/list search, notifications.
- Moderation UI (report queue, admin actions) — schema (`ContentReport`, `ModerationAction`)
  is in place from slice 1; no endpoints/UI yet.

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
