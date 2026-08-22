# Base image with pnpm
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/db/package.json ./packages/db/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS builder

# Copy node_modules first
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules

# Copy config files
COPY package.json pnpm-workspace.yaml tsconfig.json ./

# Copy db package source files (without node_modules)
COPY packages/db/src ./packages/db/src
COPY packages/db/drizzle ./packages/db/drizzle
COPY packages/db/package.json packages/db/tsconfig.json packages/db/drizzle.config.ts ./packages/db/

# Copy worker source files (without node_modules)
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/package.json apps/worker/tsconfig.json ./apps/worker/

# Build database package first
WORKDIR /app/packages/db
RUN pnpm build

# Build worker app
WORKDIR /app/apps/worker
RUN pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV TZ=Europe/Berlin

RUN apk add --no-cache tzdata
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 workeruser

COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/package.json

# pnpm-Layout beibehalten: Symlinks zeigen relativ auf /app/node_modules/.pnpm
# und /app/packages/db — daher alle node_modules-Verzeichnisse 1:1 kopieren
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

USER workeruser

EXPOSE 3002
ENV PORT=3002

CMD ["node", "apps/worker/dist/index.js"]
