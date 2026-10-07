# n8n Production Deployment for WAVES Acquisition OS

## Overview
This directory contains the production-ready Docker Compose configuration for deploying n8n at `https://n8n.wavesco.in`.

## Architecture
```
Internet
    ↓
https://n8n.wavesco.in (nginx + Let's Encrypt TLS)
    ↓
n8n container (port 5678, internal only)
    ↓
PostgreSQL (persistent storage)
```

## Quick Start (Production Server)

### Prerequisites
- Docker & Docker Compose installed
- Domain `n8n.wavesco.in` pointing to server IP (A record)
- Ports 80, 443 open on firewall

### Required Environment Variables
```bash
export N8N_ENCRYPTION_KEY="your-32-char-encryption-key"
export N8N_BASIC_AUTH_USER="admin"
export N8N_BASIC_AUTH_PASSWORD="secure-password"
export POSTGRES_DB="n8n"
export POSTGRES_USER="n8n"
export POSTGRES_PASSWORD="secure-postgres-password"
```

### Deploy
```bash
chmod +x deploy.sh
./deploy.sh
```

### Verify
- https://n8n.wavesco.in → n8n editor (basic auth)
- https://n8n.wavesco.in/healthz → health check
- https://n8n.wavesco.in/webhook/... → webhook endpoints

## Security Features
- ✅ HTTPS only (HTTP → HTTPS redirect)
- ✅ Let's Encrypt TLS (auto-renewal via certbot)
- ✅ Basic Auth on editor
- ✅ Secure cookies (HttpOnly, Secure, SameSite=Strict)
- ✅ Rate limiting (editor: 30r/s, webhooks: 10r/s)
- ✅ Security headers (HSTS, CSP-ready, X-Frame-Options, etc.)
- ✅ PostgreSQL persistence (not SQLite)
- ✅ Internal network only (no direct port 5678 exposure)
- ✅ Encryption key for credential storage
- ✅ Secure cookie settings

## Acquisition OS Integration

### Environment Variable
Set in Vercel/Production:
```
N8N_BASE_URL=https://n8n.wavesco.in
```

### Usage in Acquisition OS
```typescript
const n8nBaseUrl = process.env.N8N_BASE_URL;
const response = await fetch(`${n8nBaseUrl}/webhook/acquisition-trigger`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${N8N_WEBHOOK_SECRET}`
  },
  body: JSON.stringify({ tenantId, action: 'generate_leads' })
});
```

## Maintenance

### Restart Services
```bash
docker compose restart
```

### View Logs
```bash
docker compose logs -f n8n
docker compose logs -f nginx
```

### Backup Database
```bash
docker compose exec postgres pg_dump -U n8n n8n > backup_$(date +%Y%m%d).sql
```

### Restore Database
```bash
docker compose exec -T postgres psql -U n8n n8n < backup.sql
```

### Update n8n Version
```bash
# Edit docker-compose.yml image tag
docker compose pull
docker compose up -d
```

## Troubleshooting

### Certificate Issues
```bash
# Force renewal
docker compose run --rm certbot certonly --force-renewal -d n8n.wavesco.in
docker compose exec nginx nginx -s reload
```

### Reset Password
```bash
# Edit .env and restart
docker compose restart n8n
```

### Database Connection Issues
```bash
docker compose logs postgres
docker compose exec postgres pg_isready -U n8n -d n8n
```