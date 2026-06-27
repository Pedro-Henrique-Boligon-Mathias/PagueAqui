FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/realtime/package.json apps/realtime/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/config/package.json packages/config/package.json
RUN corepack pnpm install --frozen-lockfile

FROM deps AS build
COPY apps/realtime apps/realtime
COPY packages packages
COPY tsconfig*.json ./
RUN corepack pnpm --filter @leitor-nfce/shared build
RUN corepack pnpm --filter @leitor-nfce/realtime build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=deps /app/apps/realtime/package.json apps/realtime/package.json
COPY --from=deps /app/packages/shared/package.json packages/shared/package.json
COPY --from=build /app/apps/realtime/dist apps/realtime/dist
COPY --from=build /app/packages/shared/dist packages/shared/dist
EXPOSE 3333
CMD ["node", "apps/realtime/dist/index.js"]
