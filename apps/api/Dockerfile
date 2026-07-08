# Cinelog API — built from the monorepo root as build context.
#   docker build -f apps/api/Dockerfile -t cinelog-api .
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-workspace.yaml package.json tsconfig.base.json turbo.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @cinelog/contracts build \
  && pnpm --filter @cinelog/api exec prisma generate \
  && pnpm --filter @cinelog/api build
# Prune to production dependencies for a slimmer runtime image, then (re)generate
# the Prisma client INSIDE the pruned tree — pnpm's deploy relinks node_modules
# from the store, so the client generated above may not survive. `prisma` is a
# prod dependency, so both the CLI (for `migrate deploy` at boot) and the freshly
# generated client are present in /app.
RUN pnpm --filter @cinelog/api --prod deploy /app \
  && cd /app && node_modules/.bin/prisma generate --schema prisma/schema.prisma

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
