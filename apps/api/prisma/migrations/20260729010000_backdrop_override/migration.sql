-- Artwork overrides gain a backdrop, alongside the existing poster. Both are
-- per-member and library-scoped: they never change the title itself.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_user_poster_override" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "mediaItemId" TEXT NOT NULL,
    "url" TEXT,
    "backdropUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_poster_override_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_poster_override_mediaItemId_fkey" FOREIGN KEY ("mediaItemId") REFERENCES "media_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_user_poster_override" ("createdAt", "id", "mediaItemId", "url", "userId") SELECT "createdAt", "id", "mediaItemId", "url", "userId" FROM "user_poster_override";
DROP TABLE "user_poster_override";
ALTER TABLE "new_user_poster_override" RENAME TO "user_poster_override";
CREATE INDEX "user_poster_override_mediaItemId_idx" ON "user_poster_override"("mediaItemId");
CREATE UNIQUE INDEX "user_poster_override_userId_mediaItemId_key" ON "user_poster_override"("userId", "mediaItemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

