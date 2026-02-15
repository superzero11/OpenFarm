FROM node:20-alpine AS base

# Install deps
FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

# Build
FROM base AS builder
WORKDIR /app

# NEXT_PUBLIC_* vars must be present at build time (inlined by Next.js)
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/v1
ARG NEXT_PUBLIC_TITILER_URL=http://localhost:8080
ARG NEXT_PUBLIC_PROTOMAPS_URL=http://localhost:9000/openfarm/basemap
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_TITILER_URL=$NEXT_PUBLIC_TITILER_URL
ENV NEXT_PUBLIC_PROTOMAPS_URL=$NEXT_PUBLIC_PROTOMAPS_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
