FROM node:22-alpine AS build

ARG BUILD_VERSION=0.1.0

WORKDIR /src

COPY package.json package-lock.json .

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine

ARG BUILD_VERSION=0.1.0

LABEL org.opencontainers.image.title="db-proxy"
LABEL org.opencontainers.image.version=$BUILD_VERSION

ENV APP_VERSION=$BUILD_VERSION

COPY --from=build /src/db-proxy.cjs /app/db-proxy.cjs

EXPOSE 80

ENTRYPOINT ["node", "/app/db-proxy.cjs"]
