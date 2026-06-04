# Infra

Hosting topology:

| Service | Where | URL |
|---|---|---|
| Next.js app | Vercel team `creaits-projects` | `cc.getcreait.com` |
| MCP server (Second Brain + GHL) | Hostinger VPS `2.24.116.77` (Docker + Traefik) | `mcp.getcreait.com` |
| Background jobs | Inngest Cloud (free tier) | inngest.com app `creait-cc` |
| Database | Supabase project `choxhzsfmiftdaanrkpa` | supabase.com |
| Auth | Clerk app `app_3EeuMhAyKWRXwdaeOld6d5cBU0e` | clerk.com |

## DNS records to add on Hostinger

| Type | Name | Value |
|---|---|---|
| A | `mcp.getcreait.com` | `2.24.116.77` |
| CNAME | `cc.getcreait.com` | `cname.vercel-dns.com` |

## VPS state (already in place)

- Ubuntu 24.04, Docker, Traefik (with `letsencrypt` cert resolver assumed)
- Existing containers `hermes-webui-*` (port 32768) and `hermes-workspace-*` (port 32769) — untouched
- New container `creait-mcp` joins the existing `traefik` Docker network

## Deploying the MCP server

```bash
ssh root@2.24.116.77
mkdir -p /etc/creait-mcp /opt/creait-mcp/data
cat > /etc/creait-mcp/.env <<'EOF'
MCP_TOKEN=<value-from-local-.env>
DATA_DIR=/data
GETCREAIT_PIT=<value>
GETCREAIT_LOCATION_ID=XJuOjmYZEFS65kTCilsH
EOF
chmod 600 /etc/creait-mcp/.env

# Clone repo to VPS or push image to a registry. For Phase 1 stub:
cd /opt && git clone https://github.com/Creait-tech/Creait_Command-center.git creait-cc
cd /opt/creait-cc
docker compose -f infra/docker-compose.yml up -d --build

# Confirm
curl -sf https://mcp.getcreait.com/health
```
