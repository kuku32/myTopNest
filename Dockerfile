# ---------- Stage 1: Build ----------
    FROM node:20-bookworm-slim AS build

    # Set working directory
    WORKDIR /app
    
    # Copy dependency files first (better caching)
    COPY package*.json ./
    
    # Install dependencies (no cache, clean npm cache afterward)
    RUN npm ci && npm cache clean --force
    
    # Copy the rest of the source code
    COPY . .
    
    # Build the NestJS project
    RUN npm run build
    
    # ---------- Stage 2: Run ----------
    FROM node:20-bookworm-slim AS production
    
    # Set environment variables
    ENV NODE_ENV=production
    ENV PORT=3000
    
    WORKDIR /app
    
    # Copy dependency files
    COPY package*.json ./
    
    # Install only production dependencies
    RUN npm ci --omit=dev && npm cache clean --force
    
    # Copy the compiled dist folder from build stage
    COPY --from=build /app/dist ./dist
    
    # Set a non-root user for security
    RUN useradd -m nestjsuser
    USER nestjsuser
    
    # Expose port for Render
    EXPOSE ${PORT}
    
    # Healthcheck (optional)
    HEALTHCHECK CMD node -e "fetch('http://localhost:' + process.env.PORT).then(r => r.ok || process.exit(1)).catch(() => process.exit(1))"
    
    # Start the app
    CMD ["node", "dist/main.js"]
    