# PROD: frontend image — static dist served by nginx (see ../nginx.conf.sample for TLS host)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_API_URL must be set at build time (baked into bundle). Example:
# docker build --build-arg VITE_API_URL=https://api.industry.gov.eg -f frontend/Dockerfile .
ARG VITE_API_URL=http://localhost:4000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
