# Build stage — npm workspaces. APP selects which app to build: portal, notes, …
FROM node:20-alpine AS build
ARG APP=portal
WORKDIR /app
COPY . .
RUN npm ci
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @familyadmin/$APP

# Runtime stage
FROM node:20-alpine
ARG APP=portal
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build /app/apps/$APP/.next/standalone ./
COPY --from=build /app/apps/$APP/.next/static ./apps/$APP/.next/static
COPY --from=build /app/apps/$APP/public ./apps/$APP/public
ENV APP=$APP
CMD ["sh", "-c", "exec node apps/$APP/server.js"]
EXPOSE 3000
