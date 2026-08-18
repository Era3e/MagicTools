FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @mt/__NAME__-web build

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/__NAME__/web/dist /usr/share/nginx/html
COPY --from=build /repo/apps/__NAME__/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE __WEB_PORT__
