# ── 1) frontend build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY contracts /build/contracts
ENV VITE_API_URL= \
    VITE_SAME_ORIGIN=1
RUN npm run build

# ── 2) backend build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS api
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY backend/assets ./assets
COPY contracts ./contracts
RUN npm run build

# ── 3) runtime ───────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/data/app.db \
    UPLOAD_DIR=/data/uploads \
    BACKUP_DIR=/data/backups \
    SEED_ON_BOOT=1 \
    SERVE_FRONTEND=1 \
    FRONTEND_DIST=/app/public \
    TRUST_PROXY=1 \
    ALLOW_DEMO_AUTH=0

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=api /app/dist ./dist
COPY --from=api /app/contracts ./contracts
COPY --from=api /app/scripts ./scripts
COPY --from=api /app/assets ./assets
COPY --from=web /build/frontend/dist ./public
COPY seed-data.json ./seed-data.json

RUN mkdir -p /data/uploads && chown -R node:node /data
RUN apk add --no-cache curl

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
