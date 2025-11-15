# =========================
# Stage 1: Build frontend
# =========================
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Allow overriding backend URL via build arg
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build

# =========================
# Stage 2: Serve static app
# =========================
FROM node:20-alpine
WORKDIR /app

RUN npm install -g serve
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV PORT=8080 \
    API_BASE_URL=""
EXPOSE 8080

ENTRYPOINT ["docker-entrypoint.sh"]

