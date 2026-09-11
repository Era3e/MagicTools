ARG NODE_IMAGE=node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && pnpm config set store-dir /pnpm/store
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=magictools-pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=magictools-pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN --mount=type=cache,id=magictools-pnpm,target=/pnpm/store --mount=type=cache,id=magictools-turbo,target=/repo/.turbo pnpm exec turbo run build --filter=@mt/applicant-server && pnpm --filter=@mt/applicant-server deploy --prod --prefer-offline /out
RUN cp infra/scripts/container-health.cjs /out/healthcheck.cjs

FROM ${NODE_IMAGE} AS runtime
ARG VCS_REF
LABEL org.opencontainers.image.revision=$VCS_REF
WORKDIR /app
ENV NODE_ENV=production APP_NAME=applicant PORT=5008
COPY --from=build --chown=node:node /out/ ./
USER node
EXPOSE 5008
HEALTHCHECK --interval=10s --timeout=6s --start-period=30s --retries=3 CMD ["node", "healthcheck.cjs"]
CMD ["node", "dist/main.js"]
