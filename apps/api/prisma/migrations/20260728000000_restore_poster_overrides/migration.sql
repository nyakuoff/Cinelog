-- Poster overrides come back as a per-user table (not global): a member's
-- chosen poster only affects their own view and their own library/profile as
-- seen by others, not the title everywhere.
CREATE TABLE "user_poster_override" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_poster_override_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_poster_override_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "media_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "user_poster_override_mediaItemId_idx" ON "user_poster_override"("mediaItemId");

CREATE UNIQUE INDEX "user_poster_override_userId_mediaItemId_key" ON "user_poster_override"("userId", "mediaItemId");
