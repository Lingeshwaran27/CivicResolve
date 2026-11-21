# syntax=docker/dockerfile:1
# Single-container build: React client + Express API. Works on Google Cloud Run and Render.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev --workspace server --include-workspace-root=false --no-audit --no-fund

FROM node:24-slim AS runtime
ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/client/dist
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/assets ./server/assets
COPY --from=build /app/client/dist ./client/dist
USER node
EXPOSE 8080
CMD ["node", "server/dist/index.js"]
