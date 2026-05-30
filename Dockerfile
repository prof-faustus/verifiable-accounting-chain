# Reproducible build/run image. The toolchain of record is in ENVIRONMENT.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY scripts ./scripts
RUN npm ci
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/config ./config
# The CLI entry point; override CMD to run the service or a study.
ENTRYPOINT ["node", "packages/cli/dist/index.js"]
CMD ["selftest"]
