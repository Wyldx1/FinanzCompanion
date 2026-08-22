# Base image with pnpm
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY packages/db/package.json ./packages/db/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile

# Build the application
FROM base AS builder

# Copy node_modules first
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy config files
COPY package.json pnpm-workspace.yaml tsconfig.json ./

# Copy db package source files (without node_modules)
COPY packages/db/src ./packages/db/src
COPY packages/db/drizzle ./packages/db/drizzle
COPY packages/db/package.json packages/db/tsconfig.json packages/db/drizzle.config.ts ./packages/db/

# Copy web source files (without node_modules)
COPY apps/web/src ./apps/web/src
COPY apps/web/public ./apps/web/public
COPY apps/web/package.json apps/web/tsconfig.json apps/web/next.config.mjs apps/web/tailwind.config.ts apps/web/postcss.config.mjs ./apps/web/

# Build database package first
WORKDIR /app/packages/db
RUN pnpm build

# Build web app
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# Production image
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone-Build unter apps/web ablegen — die enthaltenen pnpm-Symlinks
# (node_modules/next -> ../../../node_modules/.pnpm/...) erwarten den
# pnpm-Store genau drei Ebenen hoeher, also unter /app/node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./apps/web
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=deps /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]
