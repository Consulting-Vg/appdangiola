# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy frontend package files and install dependencies
COPY frontend/package*.json ./
RUN npm install

# Copy frontend files and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Node.js backend
FROM node:20-alpine
WORKDIR /app

# Copy backend package files and install production dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy backend source files
COPY backend/ ./backend/

# Copy built frontend assets to frontend/dist in the backend execution workspace
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port 8080 (default for Cloud Run)
EXPOSE 8080
ENV PORT=8080

# Run the server
WORKDIR /app/backend
CMD ["node", "server.js"]
