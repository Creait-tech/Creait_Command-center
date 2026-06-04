FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install -g pnpm@10 && pnpm install --prod=false
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
# /data volume mounted at runtime
RUN mkdir -p /data
ENV DATA_DIR=/data
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js"]
