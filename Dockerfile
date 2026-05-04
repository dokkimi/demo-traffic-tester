# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json yarn.lock ./
COPY tsconfig.json ./
COPY tsconfig.build.json ./
COPY nest-cli.json ./

RUN yarn install --frozen-lockfile

COPY src ./src

RUN yarn build

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "dist/main"]
