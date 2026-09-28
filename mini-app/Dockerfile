FROM node:22.14.0-bookworm-slim AS dependencies
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
ARG NEXT_PUBLIC_ENABLE_LOCAL_LOGIN=false
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_ENABLE_LOCAL_LOGIN=$NEXT_PUBLIC_ENABLE_LOCAL_LOGIN
COPY . .
RUN npm run build

FROM node:22.14.0-bookworm-slim AS runtime
WORKDIR /srv
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /srv/.next/standalone ./
COPY --from=build --chown=node:node /srv/.next/static ./.next/static
COPY --from=build --chown=node:node /srv/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
