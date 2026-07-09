FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# 1. Copy the pre-built static assets directly from your host build folder
COPY --chown=nextjs:nodejs apps/web/.next/static ./apps/web/.next/static

# 2. Copy the entire standalone engine bundle into the container root
COPY --chown=nextjs:nodejs apps/web/.next/standalone ./

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
