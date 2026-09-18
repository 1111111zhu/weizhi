ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS builder

ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

ARG PNPM_FETCH_RETRIES=5
ARG PNPM_FETCH_RETRY_MINTIMEOUT=10000
ARG PNPM_FETCH_RETRY_MAXTIMEOUT=120000
ARG PNPM_FETCH_TIMEOUT=600000
ARG PNPM_NETWORK_CONCURRENCY=8

WORKDIR /repo

RUN set -eux; \
  printf 'fetch-retries=%s\nfetch-retry-mintimeout=%s\nfetch-retry-maxtimeout=%s\nfetch-timeout=%s\nnetwork-concurrency=%s\nverify-deps-before-run=false\n' \
    "$PNPM_FETCH_RETRIES" \
    "$PNPM_FETCH_RETRY_MINTIMEOUT" \
    "$PNPM_FETCH_RETRY_MAXTIMEOUT" \
    "$PNPM_FETCH_TIMEOUT" \
    "$PNPM_NETWORK_CONCURRENCY" >> /root/.npmrc; \
  apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.5.0 --activate \
  && pnpm config set fetch-retries "$PNPM_FETCH_RETRIES" \
  && pnpm config set fetch-retry-mintimeout "$PNPM_FETCH_RETRY_MINTIMEOUT" \
  && pnpm config set fetch-retry-maxtimeout "$PNPM_FETCH_RETRY_MAXTIMEOUT" \
  && pnpm config set fetch-timeout "$PNPM_FETCH_TIMEOUT" \
  && pnpm config set network-concurrency "$PNPM_NETWORK_CONCURRENCY" \
  && pnpm config set verify-deps-before-run false

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json

RUN --mount=type=cache,id=projectwing-pnpm-store,target=/pnpm/store,sharing=locked \
  pnpm --config.verify-deps-before-run=false install --frozen-lockfile --store-dir /pnpm/store

COPY packages/shared packages/shared
COPY apps/api apps/api

ENV DATABASE_URL="postgresql://projectwing:projectwing@localhost:5432/projectwing?schema=public"

RUN pnpm --filter @project-wing/shared build
RUN pnpm --filter @project-wing/api prisma:generate
RUN pnpm --filter @project-wing/api build

FROM ${NODE_IMAGE} AS runner

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH="${PNPM_HOME}:${PATH}"

ARG PNPM_FETCH_RETRIES=5
ARG PNPM_FETCH_RETRY_MINTIMEOUT=10000
ARG PNPM_FETCH_RETRY_MAXTIMEOUT=120000
ARG PNPM_FETCH_TIMEOUT=600000
ARG PNPM_NETWORK_CONCURRENCY=8

WORKDIR /app

RUN set -eux; \
  printf 'fetch-retries=%s\nfetch-retry-mintimeout=%s\nfetch-retry-maxtimeout=%s\nfetch-timeout=%s\nnetwork-concurrency=%s\nverify-deps-before-run=false\n' \
    "$PNPM_FETCH_RETRIES" \
    "$PNPM_FETCH_RETRY_MINTIMEOUT" \
    "$PNPM_FETCH_RETRY_MAXTIMEOUT" \
    "$PNPM_FETCH_TIMEOUT" \
    "$PNPM_NETWORK_CONCURRENCY" >> /root/.npmrc; \
  apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl fonts-arphic-ukai fonts-liberation2 fonts-noto-cjk gnupg openssl poppler-utils \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl --fail --silent --show-error https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg \
  && printf 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main\n' \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client-17 \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.5.0 --activate \
  && pnpm config set fetch-retries "$PNPM_FETCH_RETRIES" \
  && pnpm config set fetch-retry-mintimeout "$PNPM_FETCH_RETRY_MINTIMEOUT" \
  && pnpm config set fetch-retry-maxtimeout "$PNPM_FETCH_RETRY_MAXTIMEOUT" \
  && pnpm config set fetch-timeout "$PNPM_FETCH_TIMEOUT" \
  && pnpm config set network-concurrency "$PNPM_NETWORK_CONCURRENCY" \
  && pnpm config set verify-deps-before-run false

COPY --from=builder /repo/package.json /app/package.json
COPY --from=builder /repo/pnpm-lock.yaml /app/pnpm-lock.yaml
COPY --from=builder /repo/pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY --from=builder /repo/tsconfig.base.json /app/tsconfig.base.json
COPY --from=builder /repo/node_modules /app/node_modules
COPY --from=builder /repo/packages/shared /app/packages/shared
COPY --from=builder /repo/apps/api /app/apps/api

COPY apps/api/docker-entrypoint.sh /usr/local/bin/projectwing-api-entrypoint
RUN chmod +x /usr/local/bin/projectwing-api-entrypoint \
  && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["projectwing-api-entrypoint"]
