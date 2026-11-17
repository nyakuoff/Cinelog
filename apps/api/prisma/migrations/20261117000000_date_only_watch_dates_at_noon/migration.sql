-- Data fix, not a schema change.
--
-- Letterboxd exports date-only watch dates (YYYY-MM-DD), and the importer
-- used to parse them with `new Date('YYYY-MM-DD')` — UTC midnight — which
-- renders as the previous day anywhere west of UTC. Date-only input is now
-- stored at 12:00 UTC (see common/dates.ts parseWatchDate); this moves the
-- already-imported values the same way.
--
-- Identification: a value at exactly 00:00:00.000 UTC. Dates logged through
-- the app are local noon converted to UTC, or "now" with millisecond
-- precision, so they essentially never land there. The one exception is a
-- member at UTC+12 logging through the web form (local noon = 00:00 UTC);
-- such an entry would move forward by half a day in UTC, i.e. it reads as
-- the next day for them. Accepted: no other signal distinguishes imports.
--
-- Prisma stores DateTime on SQLite as integer epoch milliseconds.

UPDATE "watch_history"
SET "watchedAt" = "watchedAt" + 43200000
WHERE typeof("watchedAt") = 'integer' AND "watchedAt" % 86400000 = 0;

UPDATE "reviews"
SET "watchedDate" = "watchedDate" + 43200000
WHERE typeof("watchedDate") = 'integer' AND "watchedDate" % 86400000 = 0;

UPDATE "user_media_status"
SET "completedAt" = "completedAt" + 43200000
WHERE typeof("completedAt") = 'integer' AND "completedAt" % 86400000 = 0;
