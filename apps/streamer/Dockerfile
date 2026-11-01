FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 expressjs
USER expressjs

COPY node_modules ./node_modules
COPY package.json ./package.json

COPY packages ./packages

COPY apps/streamer ./apps/streamer

EXPOSE 5002

CMD ["node", "apps/streamer/dist/index.js"]
