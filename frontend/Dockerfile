# =============================================================================
# Frontend Dockerfile — Multi-stage build for Next.js (standalone output)
# =============================================================================

# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:18-alpine AS runner

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static


ENV NODE_ENV=production

EXPOSE 3000

USER appuser

CMD ["node", "server.js"]
