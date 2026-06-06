FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin-web/package.json apps/admin-web/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @feishu-iam/api prisma:generate
RUN pnpm --filter @feishu-iam/api build
RUN pnpm --filter @feishu-iam/admin-web build
RUN pnpm --filter @feishu-iam/api deploy --prod /prod/api
RUN set -eux; \
  generated_client="$(find /app/node_modules/.pnpm -path '*/node_modules/.prisma/client' -type d -print -quit)"; \
  runtime_client="$(find /prod/api/node_modules/.pnpm -path '*/node_modules/@prisma/client' -type d -print -quit)"; \
  runtime_prisma_dir="$(dirname "$(dirname "${runtime_client}")")/.prisma"; \
  mkdir -p "${runtime_prisma_dir}"; \
  rm -rf "${runtime_prisma_dir}/client"; \
  cp -R "${generated_client}" "${runtime_prisma_dir}/client"

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /prod/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/admin-web/dist ./apps/admin-web/dist
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node deploy/apply-migrations-in-container.sh ./deploy/apply-migrations-in-container.sh
COPY --chown=node:node package.json pnpm-workspace.yaml ./
COPY --chown=node:node apps/api/package.json apps/api/package.json
EXPOSE 3000
USER node
CMD ["node", "apps/api/dist/main.js"]
