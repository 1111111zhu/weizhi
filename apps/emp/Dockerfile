ARG NODE_IMAGE=node:22-bookworm-slim

FROM ${NODE_IMAGE} AS builder

ARG NEXT_PUBLIC_API_BASE_URL=https://emp.superfx.cn/api
ARG NEXT_PUBLIC_AUTH_BASE_URL=https://auth.superfx.cn
ARG NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX=superfx.cn
ARG NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL=/downloads/desktop-agent-win-x64.exe
ARG NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL=/downloads/desktop-agent-macos-arm64.pkg
ARG NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION=0.2.0
ARG NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION=0.1.10
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_AUTH_BASE_URL=${NEXT_PUBLIC_AUTH_BASE_URL}
ENV NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX=${NEXT_PUBLIC_PROJECTWING_DOMAIN_SUFFIX}
ENV NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL=${NEXT_PUBLIC_DESKTOP_AGENT_WINDOWS_DOWNLOAD_URL}
ENV NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL=${NEXT_PUBLIC_DESKTOP_AGENT_MACOS_DOWNLOAD_URL}
ENV NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION=${NEXT_PUBLIC_DESKTOP_AGENT_MINIMUM_VERSION}
ENV NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION=${NEXT_PUBLIC_DESKTOP_AGENT_SELF_UPDATE_MINIMUM_VERSION}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536
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
  corepack enable; \
  corepack prepare pnpm@11.5.0 --activate; \
  pnpm config set fetch-retries "$PNPM_FETCH_RETRIES"; \
  pnpm config set fetch-retry-mintimeout "$PNPM_FETCH_RETRY_MINTIMEOUT"; \
  pnpm config set fetch-retry-maxtimeout "$PNPM_FETCH_RETRY_MAXTIMEOUT"; \
  pnpm config set fetch-timeout "$PNPM_FETCH_TIMEOUT"; \
  pnpm config set network-concurrency "$PNPM_NETWORK_CONCURRENCY"; \
  pnpm config set verify-deps-before-run false

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/emp/package.json apps/emp/package.json

RUN --mount=type=cache,id=projectwing-pnpm-store,target=/pnpm/store,sharing=locked \
  pnpm --config.verify-deps-before-run=false install --frozen-lockfile --store-dir /pnpm/store

COPY packages/shared packages/shared
COPY apps/emp apps/emp

RUN pnpm --filter @project-wing/shared build
RUN --mount=type=cache,id=projectwing-next-cache-emp,target=/repo/apps/emp/.next/cache,sharing=locked \
  pnpm --filter @project-wing/emp exec next build

FROM ${NODE_IMAGE} AS runner

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/emp/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/emp/.next/static ./apps/emp/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/emp/public ./apps/emp/public

USER nextjs

EXPOSE 3001

CMD ["node", "apps/emp/server.js"]
