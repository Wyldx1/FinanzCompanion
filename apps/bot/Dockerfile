# Base image with pnpm
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/db/package.json ./packages/db/
COPY apps/bot/package.json ./apps/bot/
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS builder

# Copy node_modules first
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules

# Copy config files
COPY package.json pnpm-workspace.yaml tsconfig.json ./

# Copy db package source files (without node_modules)
COPY packages/db/src ./packages/db/src
COPY packages/db/drizzle ./packages/db/drizzle
COPY packages/db/package.json packages/db/tsconfig.json packages/db/drizzle.config.ts ./packages/db/

# Copy bot source files (without node_modules)
COPY apps/bot/src ./apps/bot/src
COPY apps/bot/package.json apps/bot/tsconfig.json ./apps/bot/

# Build database package first
WORKDIR /app/packages/db
RUN pnpm build

# Build bot app
WORKDIR /app/apps/bot
RUN pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 botuser

COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/bot/dist ./apps/bot/dist
COPY --from=builder /app/apps/bot/package.json ./apps/bot/package.json

# pnpm-Layout beibehalten: Symlinks zeigen relativ auf /app/node_modules/.pnpm
# und /app/packages/db — daher alle node_modules-Verzeichnisse 1:1 kopieren
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

USER botuser

EXPOSE 3001
ENV PORT=3001

CMD ["node", "apps/bot/dist/index.js"]
