# CREAIT MCP Server

Second Brain + GHL tools combined into a single MCP server, deployed to the Hostinger VPS behind Traefik at `mcp.getcreait.com`.

**Status:** Stubbed in Phase 1. Full implementation in Phase 2 (see `.claude/plans/deep-stargazing-pretzel.md`).

## Tools exposed

| Category | Tool | Purpose |
|---|---|---|
| Second Brain | `search_context` | Keyword search across `/data/**/*.md` |
| Second Brain | `get_file` | Read one markdown file |
| Second Brain | `update_file` | Write or append to a markdown file |
| Second Brain | `list_topics` | Tree listing of `/data` |
| GHL | `ghl_get_contacts` | List contacts (paginated) |
| GHL | `ghl_get_opportunities` | List opps by pipeline |
| GHL | `ghl_get_conversations` | Recent conversations |
| GHL | `ghl_send_message` | Send SMS/email through a conversation |
| GHL | `ghl_update_opp_stage` | Move opportunity between stages |

## Auth

Bearer token via `MCP_TOKEN` env var. Same value lives on Vercel and on the VPS `/etc/creait-mcp/.env`.

## Deploy (Phase 2)

```bash
# On VPS (ssh root@2.24.116.77)
mkdir -p /etc/creait-mcp
echo "MCP_TOKEN=<value>" > /etc/creait-mcp/.env
echo "DATA_DIR=/data" >> /etc/creait-mcp/.env
echo "GETCREAIT_PIT=<value>" >> /etc/creait-mcp/.env
echo "GETCREAIT_LOCATION_ID=XJuOjmYZEFS65kTCilsH" >> /etc/creait-mcp/.env

# From repo root locally:
docker compose -f infra/docker-compose.yml up -d --build
```

DNS prerequisite: `mcp.getcreait.com A 2.24.116.77` on Hostinger DNS panel.
