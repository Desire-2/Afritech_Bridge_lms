# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app
# pnpm is this project's package manager (pnpm-lock.yaml is the only lockfile).
RUN corepack enable && corepack prepare pnpm@10 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# NEXT_PUBLIC_API_URL is consumed at build time for rewrites/API calls.
# Pass it via --build-arg (compose does this automatically).
ARG NEXT_PUBLIC_API_URL=http://localhost:5000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm run build

# ---- runtime stage ----
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./

EXPOSE 3001
CMD ["node_modules/.bin/next", "start"]
