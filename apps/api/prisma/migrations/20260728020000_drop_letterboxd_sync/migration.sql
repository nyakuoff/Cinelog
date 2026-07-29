-- Letterboxd live sync is removed (the RSS pull only ever saw ~50 recent
-- entries and the full-export import supersedes it), so its two columns go
-- with it. No other data on users is touched by the table rebuild below.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "bio" TEXT,
    "ratingScale" TEXT NOT NULL DEFAULT 'TEN',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "displayName" TEXT,
    "profileVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "watchlistVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatarUrl", "bannerUrl", "bio", "createdAt", "displayName", "email", "id", "passwordHash", "profileVisibility", "ratingScale", "role", "settings", "updatedAt", "username", "watchlistVisibility") SELECT "avatarUrl", "bannerUrl", "bio", "createdAt", "displayName", "email", "id", "passwordHash", "profileVisibility", "ratingScale", "role", "settings", "updatedAt", "username", "watchlistVisibility" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

