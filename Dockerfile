# SINGLE-SERVICE image (Coolify / any one-container host): frontend + API on ONE domain.
# The API serves the built SPA (SERVE_FRONTEND=1) and the SPA calls /api/v1 on the same
# origin — no CORS, no second domain, no nginx. TLS is terminated by the host proxy
# (Coolify's Traefik). The split api+frontend+nginx setup stays in docker-compose.yml.
# See docs/DEPLOY.md → «النشر على Coolify».

# ── 1) frontend build (VITE_API_URL empty = same-origin) ─────────────────────
FROM node:22-alpine AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Keep the repo layout: src/api/schemas.ts re-exports ../../../contracts/api.contracts.
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
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    DB_PATH=/data/app.db \
    UPLOAD_DIR=/data/uploads \
    BACKUP_DIR=/data/backups \
    SERVE_FRONTEND=1 \
    FRONTEND_DIST=/app/public \
    TRUST_PROXY=1 \
    ALLOW_DEMO_AUTH=0
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=api /app/dist ./dist
COPY --from=api /app/contracts ./contracts
COPY --from=api /app/scripts ./scripts
# شعار الوزارة المضمّن في بريد المنصة الرسمي (cid:platform-logo)
COPY --from=api /app/assets ./assets
COPY --from=web /build/frontend/dist ./public
# Demo dataset for the optional one-off: CONFIRM=YES node dist/db/seed-file-cli.js
COPY seed-data.json ./seed-data.json
# /data = persistent volume (SQLite + uploads). Pre-owned by `node` so a fresh named
# volume inherits writable ownership on first mount.
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
