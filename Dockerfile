# Step 1. Builder image
FROM node:18-alpine AS builder

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package.json package-lock.json* ./

RUN apk add --no-cache python3
RUN npm ci --legacy-peer-deps

# Copy project files
COPY src ./src
COPY public ./public
COPY next.config.js ./
COPY tsconfig.json ./


ARG NEXT_PUBLIC_API_KEY
ARG NEXT_PUBLIC_AUTH_DOMAIN
ARG NEXT_PUBLIC_PROJECT_ID
ARG NEXT_PUBLIC_STORAGE_BUCKET
ARG NEXT_PUBLIC_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_APP_ID
ARG NEXT_PUBLIC_DATABASE_URL
ARG NEXT_PUBLIC_WS_SERVER
ARG NEXT_PUBLIC_DEV_API_KEY
ARG NEXT_PUBLIC_DEV_AUTH_DOMAIN
ARG NEXT_PUBLIC_DEV_PROJECT_ID
ARG NEXT_PUBLIC_DEV_STORAGE_BUCKET
ARG NEXT_PUBLIC_DEV_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_DEV_APP_ID

ENV NEXT_PUBLIC_API_KEY=${NEXT_PUBLIC_API_KEY}
ENV NEXT_PUBLIC_AUTH_DOMAIN=${NEXT_PUBLIC_AUTH_DOMAIN}
ENV NEXT_PUBLIC_PROJECT_ID=${NEXT_PUBLIC_PROJECT_ID}
ENV NEXT_PUBLIC_STORAGE_BUCKET=${NEXT_PUBLIC_STORAGE_BUCKET}
ENV NEXT_PUBLIC_MESSAGING_SENDER_ID=${NEXT_PUBLIC_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_APP_ID=${NEXT_PUBLIC_APP_ID}
ENV NEXT_PUBLIC_DATABASE_URL=${NEXT_PUBLIC_DATABASE_URL}
ENV NEXT_PUBLIC_WS_SERVER=${NEXT_PUBLIC_WS_SERVER}
ENV NEXT_PUBLIC_DEV_API_KEY=${NEXT_PUBLIC_DEV_API_KEY}
ENV NEXT_PUBLIC_DEV_AUTH_DOMAIN=${NEXT_PUBLIC_DEV_AUTH_DOMAIN}
ENV NEXT_PUBLIC_DEV_PROJECT_ID=${NEXT_PUBLIC_DEV_PROJECT_ID}
ENV NEXT_PUBLIC_DEV_STORAGE_BUCKET=${NEXT_PUBLIC_DEV_STORAGE_BUCKET}
ENV NEXT_PUBLIC_DEV_MESSAGING_SENDER_ID=${NEXT_PUBLIC_DEV_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_DEV_APP_ID=${NEXT_PUBLIC_DEV_APP_ID}

ENV NODE_ENV=production

RUN npm run build

# Step 2. Production image (Runner)
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN apk add --no-cache libc6-compat

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js .
COPY --from=builder /app/package.json .

# Automatically leverage output traces to reduce image size 
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static



EXPOSE 3000
CMD ["node", "server.js"]