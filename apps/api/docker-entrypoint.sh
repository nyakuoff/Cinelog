#!/bin/sh
set -e

# Apply any pending migrations against the mounted /data volume, then start.
npx prisma migrate deploy --schema ./prisma/schema.prisma
exec node dist/main.js
