# Cinelog web — built from the monorepo root as build context.
#   docker build -f apps/web/Dockerfile -t cinelog-web .
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json turbo.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN pnpm --filter @cinelog/contracts build && pnpm --filter @cinelog/web build

FROM nginx:alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
