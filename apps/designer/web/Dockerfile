FROM node:20-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile && pnpm exec turbo run build --filter=@mt/designer-web

FROM nginx:1.27-alpine
COPY --from=build /repo/apps/designer/web/dist /usr/share/nginx/html
COPY --from=build /repo/apps/designer/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 4005
