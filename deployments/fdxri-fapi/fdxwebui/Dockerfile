FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Expose ports
# 3010 for DPoP signing service
# 3030 for Vite dev server
EXPOSE 3010 3030

# Create a startup script that runs both services
RUN cat > /app/start.sh << 'EOF' && chmod +x /app/start.sh
#!/bin/sh
set -e

# Function to handle shutdown
cleanup() {
    echo "Shutting down services..."
    kill $DPOP_PID 2>/dev/null || true
    kill $VITE_PID 2>/dev/null || true
    exit 0
}

# Trap signals
trap cleanup SIGTERM SIGINT

# Start DPoP signing service in background with auto-reload
echo "Starting DPoP signing service on port 3010..."
npm run dpop:dev &
DPOP_PID=$!

# Wait for DPoP service to be ready
echo "Waiting for DPoP service to start..."
for i in 1 2 3 4 5; do
    if node -e "require('http').get('http://localhost:3010/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" 2>/dev/null; then
        echo "✓ DPoP service is ready"
        break
    fi
    sleep 1
done

# Start Vite dev server
echo "Starting Vite dev server on port 3030..."
npm run dev -- --host 0.0.0.0 --port 3030 &
VITE_PID=$!

# Wait for both processes
wait $DPOP_PID $VITE_PID
EOF

# Health check for DPoP service
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3010/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/start.sh"]

