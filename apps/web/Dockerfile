FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/web/node_modules apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY packages/shared packages/shared
COPY apps/web apps/web
COPY tsconfig.base.json .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN cd apps/web && bun run build

FROM nginx:alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 5173
