# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files (lockfile pinned so dependency drift between rebuilds
# can't break the image — bson's crypto-is-global assumption bit us once)
COPY package.json package-lock.json ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./

# Install dependencies (frozen to lockfile)
RUN npm ci

# Copy source code
COPY src ./src

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files (lockfile for reproducible production install)
COPY package.json package-lock.json ./

# Install only production dependencies (frozen to lockfile)
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose the port
EXPOSE 4000

# Set NODE_ENV to production
ENV NODE_ENV=production

# Run the application
CMD ["node", "dist/main"]
