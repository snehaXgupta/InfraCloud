# Single image: API + built React app (served by the API on one origin).

# 1. Build the frontend
FROM node:22-alpine AS web
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2. Install production backend dependencies
FROM node:22-alpine AS api-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

# 3. Runtime
FROM node:22-alpine
ENV NODE_ENV=production PORT=5000
WORKDIR /app
COPY --from=api-deps /app/backend/node_modules ./backend/node_modules
COPY backend/package.json ./backend/
COPY backend/src ./backend/src
COPY backend/scripts ./backend/scripts
COPY telemetry/infra-agent.js ./telemetry/infra-agent.js
COPY --from=web /app/frontend/dist ./frontend/dist

USER node
WORKDIR /app/backend
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/api/health >/dev/null || exit 1
CMD ["node", "src/server.js"]
