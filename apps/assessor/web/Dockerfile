FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @mt/assessor-web build

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/assessor/web/dist /usr/share/nginx/html
COPY --from=build /repo/apps/assessor/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4003
