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
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY . .

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
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/worker/package.json ./
COPY --from=deps /app/apps/worker/node_modules ./node_modules

USER workeruser

EXPOSE 3002
ENV PORT=3002

CMD ["node", "dist/index.js"]
