#!/bin/sh
set -e

# Apply any pending migrations against the mounted /data volume, then start.
# Use the locally-installed Prisma CLI (a prod dependency) so there's no network
# fetch on boot.
node_modules/.bin/prisma migrate deploy --schema ./prisma/schema.prisma
exec node dist/main.js
