FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run typecheck && npm run build
FROM node:24-bookworm-slim
ENV NODE_ENV=production
ENV PORT=5000
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/sql ./sql
USER node
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=10 CMD node -e "fetch('http://127.0.0.1:5000/api/db-health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
