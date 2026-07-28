-- Per-user poster/backdrop overrides are being replaced by a single global
-- poster edit (like Letterboxd's community data corrections), so the
-- per-user override table is no longer needed.
PRAGMA foreign_keys=off;
DROP TABLE "user_artwork";
PRAGMA foreign_keys=on;
