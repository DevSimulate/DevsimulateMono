FROM node:20-slim AS base
WORKDIR /app

# Copy workspace manifests so npm can resolve workspaces
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

# Install all workspace dependencies (hoisted to root node_modules)
RUN npm ci --workspace=apps/api --include-workspace-root

# Copy API source + prisma schema
COPY apps/api/ ./apps/api/

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build TypeScript
RUN npm run build --workspace=apps/api

# ── Production image ─────────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY apps/api/package.json ./apps/api/

RUN npm ci --workspace=apps/api --include-workspace-root --omit=dev

# Copy compiled output and prisma artifacts
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/prisma ./apps/api/prisma
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/api
EXPOSE 3001

CMD ["node", "dist/index.js"]
