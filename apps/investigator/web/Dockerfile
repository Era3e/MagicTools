FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm exec turbo run build --filter=@mt/investigator-web

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/investigator/web/dist /usr/share/nginx/html
COPY --from=build /repo/apps/investigator/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4002
