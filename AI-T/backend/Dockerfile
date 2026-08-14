# =============================================================================
# Backend Dockerfile — Multi-stage build for Express/TypeScript
# =============================================================================

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production=false

COPY . .

RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
RUN npm ci --production && npm cache clean --force

ENV NODE_ENV=production

EXPOSE 4000

RUN mkdir -p /app/dist/public/uploads/avatars && \
    chown -R appuser:nodejs /app/dist/public

USER appuser

CMD ["node", "dist/index.js"]
