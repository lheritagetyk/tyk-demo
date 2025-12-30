FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY server.js ./

# Expose the webhook port
EXPOSE 8899

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8899/healthz', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

# Run the application
CMD ["npm", "start"]

