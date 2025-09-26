FROM node:22-alpine AS build

WORKDIR /src

COPY package.json package-lock.json .

RUN npm ci

COPY . .

RUN npm run build

FROM node:22-alpine

COPY --from=build /src/apps/db-proxy/db-proxy.cjs /app/db-proxy.cjs

ENTRYPOINT ["node", "/app/db-proxy.cjs"]
