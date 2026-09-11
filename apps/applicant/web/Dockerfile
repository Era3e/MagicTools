ARG NODE_IMAGE=node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32
FROM ${NODE_IMAGE} AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && pnpm config set store-dir /pnpm/store
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=magictools-pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=magictools-pnpm,target=/pnpm/store pnpm install --offline --frozen-lockfile
RUN --mount=type=cache,id=magictools-pnpm,target=/pnpm/store --mount=type=cache,id=magictools-turbo,target=/repo/.turbo pnpm exec turbo run build --filter=@mt/applicant-web

FROM nginx:1.27-alpine@sha256:65645c7bb6a0661892a8b03b89d0743208a18dd2f3f17a54ef4b76fb8e2f2a10 AS runtime
ARG VCS_REF
LABEL org.opencontainers.image.revision=$VCS_REF
COPY --from=build /repo/apps/applicant/web/dist /usr/share/nginx/html
COPY --from=build /repo/apps/applicant/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4008
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 CMD ["wget", "-q", "--spider", "http://127.0.0.1:4008/applicant/"]
