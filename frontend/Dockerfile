# PROD: frontend image — static dist served by nginx (see ../nginx.conf.sample for TLS host)
# Root-context build (compose: context . + dockerfile ./frontend/Dockerfile) because
# src/api/schemas.ts re-exports ../../../contracts/api.contracts.
FROM node:22-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
COPY contracts /app/contracts
# VITE_API_URL must be set at build time (baked into bundle). Example:
# docker build --build-arg VITE_API_URL=https://api.industry.gov.eg -f frontend/Dockerfile .
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
