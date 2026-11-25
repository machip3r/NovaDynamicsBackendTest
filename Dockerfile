FROM ghcr.io/pnpm/pnpm:12.11.2 AS pnpm

FROM node:24-bookworm-slim AS dependencies
ENV PATH="/opt/pnpm:${PATH}"
WORKDIR /app
COPY --from=pnpm /opt/pnpm /opt/pnpm
COPY package.json pnpm-lock.yaml ./

FROM dependencies AS build
RUN pnpm install --frozen-lockfile --store-dir /tmp/pnpm-store
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM dependencies AS production-dependencies
RUN pnpm install --frozen-lockfile --prod --store-dir /tmp/pnpm-store

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=production-dependencies /app/node_modules ./node_modules
RUN install -d -m 0700 -o node -g node /app/data
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
