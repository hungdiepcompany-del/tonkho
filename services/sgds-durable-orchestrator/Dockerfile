FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY services/sgds-durable-orchestrator/package.json services/sgds-durable-orchestrator/package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY services/sgds-durable-orchestrator/package.json ./package.json
COPY services/sgds-durable-orchestrator/src ./src
EXPOSE 8080
USER node
CMD ["node", "src/server.mjs"]
