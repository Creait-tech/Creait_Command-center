# ── build stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10
COPY package.json ./
RUN pnpm install --prod=false --no-frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

# ── runtime stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
RUN mkdir -p /data

# /data and env vars are provided at runtime (volume + env_file).
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/health >/dev/null || exit 1
CMD ["node", "dist/server.js"]
