#!/bin/bash
# n8n Production Deployment Script
# Run this on the production server after provisioning

set -euo pipefail

echo "=== n8n Production Deployment ==="

# Check required environment variables
required_vars=(
    "N8N_ENCRYPTION_KEY"
    "N8N_BASIC_AUTH_USER"
    "N8N_BASIC_AUTH_PASSWORD"
    "POSTGRES_DB"
    "POSTGRES_USER"
    "POSTGRES_PASSWORD"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "ERROR: Required environment variable $var is not set"
        exit 1
    fi
done

echo "✓ All required environment variables are set"

# Create .env file for docker-compose
cat > .env <<EOF
N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
N8N_BASIC_AUTH_USER=${N8N_BASIC_AUTH_USER}
N8N_BASIC_AUTH_PASSWORD=${N8N_BASIC_AUTH_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
EOF

echo "✓ Generated .env file"

# Create required directories
mkdir -p certbot/conf certbot/www

echo "✓ Created certbot directories"

# Pull latest images
echo "Pulling Docker images..."
docker compose pull

# Start services
echo "Starting services..."
docker compose up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
sleep 10

# Check service status
docker compose ps

# Wait for n8n to be ready
echo "Waiting for n8n to be ready..."
for i in {1..30}; do
    if curl -f -s http://localhost:5678/healthz > /dev/null 2>&1; then
        echo "✓ n8n is healthy"
        break
    fi
    echo "Waiting for n8n... ($i/30)"
    sleep 2
done

# Initialize Let's Encrypt certificate
echo "Initializing Let's Encrypt certificate..."
docker compose run --rm certbot certonly \
    --webroot -w /var/www/certbot \
    --email admin@wavesco.in \
    --agree-tos --no-eff-email \
    --force-renewal \
    -d n8n.wavesco.in

# Reload nginx with new certificates
docker compose exec nginx nginx -s reload

echo "=== Deployment Complete ==="
echo "n8n should now be accessible at https://n8n.wavesco.in"
echo "Default credentials: ${N8N_BASIC_AUTH_USER} / ${N8N_BASIC_AUTH_PASSWORD}"