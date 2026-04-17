FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY tsconfig.base.json .
RUN cd apps/api && bunx prisma generate
RUN cd apps/api && bunx nest build

FROM base AS runtime
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY apps/api/prisma apps/api/prisma
COPY apps/api/package.json apps/api/

RUN cd apps/api && bunx prisma generate

WORKDIR /app/apps/api
VOLUME ["/app/data"]
ENV DATABASE_URL=file:/app/data/kvkk.db
EXPOSE 3000
CMD ["sh", "-c", "bunx prisma migrate deploy && bun run dist/main.js"]
