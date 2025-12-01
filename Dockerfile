# Stage 1: Build the application
FROM node:18-alpine AS build

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY . .

# Build the NestJS application
RUN npm run build

# Stage 2: Run the application
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy built application from the previous stage
COPY --from=build /usr/src/app/dist ./dist

# Copy any additional necessary files (e.g., public folder)
# COPY --from=build /usr/src/app/public ./public

# Expose the port the app runs on
ARG PORT
EXPOSE ${PORT:-3000}
 
# Set the default command to run the NestJS app
CMD ["node", "dist/main"]
