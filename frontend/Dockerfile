# Build stage — npm workspaces: apps/portal plus packages/shared
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/portal/package.json apps/portal/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# Runtime stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/apps/portal/.next/standalone ./
COPY --from=build /app/apps/portal/.next/static ./apps/portal/.next/static
COPY --from=build /app/apps/portal/public ./apps/portal/public
CMD ["node", "apps/portal/server.js"]
EXPOSE 3000
