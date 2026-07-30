-- Data backfill, not a schema change.
--
-- "Watchlisted" existed twice and the two never met: the Watchlist button
-- writes the isWatchlisted flag, while the Watchlist page filtered on a
-- PLAN_TO_WATCH *status*. So pressing the button added nothing visible, and
-- a Letterboxd watchlist import (which set the status) landed nowhere the
-- button could ever show it.
--
-- PLAN_TO_WATCH is gone as a status; the flag is the only source of truth.
-- Every title that carried it becomes watchlisted, and loses the status so it
-- doesn't also count as actively tracked.
UPDATE "user_media_status"
SET "isWatchlisted" = 1,
    "status" = NULL
WHERE "status" = 'PLAN_TO_WATCH';
