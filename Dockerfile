ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build

WORKDIR /app
ARG VITE_IAM_API_MODE=http
ARG VITE_IAM_API_BASE_URL=
ENV VITE_IAM_API_MODE=$VITE_IAM_API_MODE
ENV VITE_IAM_API_BASE_URL=$VITE_IAM_API_BASE_URL
COPY . .
RUN npm run server:build && npm run build
RUN npm prune --omit=dev

FROM ${NODE_IMAGE} AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4100
ENV STATIC_ASSETS_DIR=/app/dist

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/dist ./dist

EXPOSE 4100
CMD ["node", "dist-server/main.js"]
