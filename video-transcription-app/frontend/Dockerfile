# Frontend Service Dockerfile
# Vite React build served via nginx
#
# Build: docker build -t video-transcription/frontend:latest ./frontend
# Run:   docker run -p 3000:80 video-transcription/frontend

# =============================================================================
# Stage 1: Build the React application
# =============================================================================
FROM --platform=linux/arm64 node:20-alpine AS builder

# Build argument for API URL (used at build time by Vite)
ARG VITE_API_URL=/api

WORKDIR /app

# Copy package files first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Set environment variable for build
ENV VITE_API_URL=${VITE_API_URL}

# Build the application
RUN npm run build

# =============================================================================
# Stage 2: Serve with nginx
# =============================================================================
FROM --platform=linux/arm64 nginx:alpine

# Install curl for health checks
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration (will be overridden by volume mount)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
