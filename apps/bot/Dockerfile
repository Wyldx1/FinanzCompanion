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
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY . .

WORKDIR /app/apps/bot
RUN pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 botuser

COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/apps/bot/dist ./dist
COPY --from=builder /app/apps/bot/package.json ./
COPY --from=deps /app/apps/bot/node_modules ./node_modules

USER botuser

EXPOSE 3001
ENV PORT=3001

CMD ["node", "dist/index.js"]
