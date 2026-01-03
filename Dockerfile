# Use Node.js 22.21.1 as the base image
FROM node:22.21.1-slim

# Install necessary dependencies for Puppeteer and xvfb (for headful mode)
RUN apt-get update && apt-get install -y \
  wget \
  curl \
  gnupg2 \
  libx11-dev \
  libx11-xcb1 \
  libxcomposite1 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  libnss3 \
  libgdk-pixbuf2.0-0 \
  libatk-bridge2.0-dev \
  libatk1.0-dev \
  libappindicator3-1 \
  libasound2 \
  fonts-liberation \
  xdg-utils \
  libu2f-udev \
  xvfb \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Set the working directory in the container
WORKDIR /app

# Copy your package.json and package-lock.json
COPY package*.json ./

# Install the project dependencies
RUN npm install

# Copy the rest of your application files into the container
COPY . .

# Expose port 8080 (or any other port your app uses)
EXPOSE 8080

# Set the environment variable for Puppeteer to use Chromium if necessary
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Run Puppeteer in headful mode using xvfb-run to simulate an X server
CMD xvfb-run -a npm start
