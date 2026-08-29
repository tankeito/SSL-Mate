# Build frontend
FROM node:22-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production runtime
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/server ./server
COPY tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=8989
ENV DATA_DIR=/app/data

EXPOSE 8989
VOLUME ["/app/data"]

CMD ["npm", "start"]
