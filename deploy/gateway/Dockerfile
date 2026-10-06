# Development only. Digest pins are multi-architecture registry indexes.
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS web-build
WORKDIR /workspace
RUN npm install --global pnpm@11.25.0 --ignore-scripts
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile --filter projectx --filter @projectx/web...
COPY apps/web/ apps/web/
COPY packages/contracts/ packages/contracts/
# Public, fixed same-origin configuration only. No ARG/secret/env-file copies.
ENV VITE_STAFF_AUTH_ENABLED=1 VITE_API_BASE_URL=/api/v1/
RUN pnpm --filter @projectx/web build

FROM nginxinc/nginx-unprivileged:1.30.5-alpine3.24@sha256:15c994d10d6d78658721c3bcafff14cb281fba2a4bdf9d5ba92c416a472516e3 AS gateway
USER root
RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /opt/projectx
COPY --from=web-build --chown=101:101 /workspace/apps/web/dist/ /usr/share/nginx/html/
COPY --chown=101:101 deploy/gateway/nginx.conf.template deploy/gateway/start.sh /opt/projectx/
# Windows Git checkouts may use CRLF; normalize only these container artifacts.
RUN sed -i 's/\r$//' /opt/projectx/start.sh /opt/projectx/nginx.conf.template
USER 101:101
EXPOSE 10000
STOPSIGNAL SIGQUIT
# Bypass vendor envsubst/access-log entrypoint; only our validated template runs.
ENTRYPOINT ["/bin/sh", "/opt/projectx/start.sh"]
