# ---------- Stage 1: Build the React client ----------
FROM node:20-alpine AS client-build
WORKDIR /app/client

# Copy only package files first to leverage Docker layer caching
COPY client/package*.json ./
RUN npm ci

# Copy client source and build the production static bundle
COPY client/ ./
RUN npm run build

# ---------- Stage 2: Set up the Express server ----------
FROM node:20-alpine AS server-deps
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci --omit=dev

# ---------- Stage 3: Final runtime image (small) ----------
FROM node:20-alpine
WORKDIR /app

# Run as non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy server code + installed production dependencies
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/ ./server/

# Copy the built React static files into server/public
# (Express serves this folder as static assets)
COPY --from=client-build /app/client/dist ./server/public

# Drop privileges
RUN chown -R appuser:appgroup /app
USER appuser

# Environment
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start the API + static frontend together
CMD ["node", "server/index.js"]
