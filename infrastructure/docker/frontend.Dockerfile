FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392 AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/student-portal/package.json apps/student-portal/package.json
COPY apps/counsellor-dashboard/package.json apps/counsellor-dashboard/package.json
COPY packages/typescript-common/package.json packages/typescript-common/package.json
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --fetch-timeout=60000
COPY packages/typescript-common packages/typescript-common
COPY apps apps
ARG APP
ENV API_INTERNAL_URL=http://orchestrator:8000
RUN npm run build --workspace=@j26/${APP}
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 API_INTERNAL_URL=http://orchestrator:8000 HOSTNAME=0.0.0.0
WORKDIR /app
ARG APP
ENV APP=${APP}
COPY --from=build --chown=node:node /app/apps/${APP}/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
USER node
EXPOSE 3000 3001
CMD ["sh", "-c", "exec node apps/$APP/server.js"]
