# 02 — Install n8n

Time: ~20 minutes. You'll install Docker, copy our config files to the server, and bring up n8n with HTTPS.

## Step 1: Install Docker on the VPS

You should be SSH'd into the server from the previous doc. Run:

```bash
# Install Docker via the official convenience script
curl -fsSL https://get.docker.com | sh

# Verify
docker --version
docker compose version
```

You should see Docker Engine and Compose plugin both installed.

## Step 2: Create the project directory

```bash
mkdir -p /opt/franklin-n8n
cd /opt/franklin-n8n
```

## Step 3: Copy config files to the server

On Maurice's local machine, from the project root:

```bash
# Replace IP with your actual server IP
scp docker/docker-compose.yml docker/Caddyfile docker/.env.example root@SERVER_IP:/opt/franklin-n8n/
```

This uploads three files:
- `docker-compose.yml` — defines the n8n + Caddy stack
- `Caddyfile` — reverse proxy + auto-HTTPS config
- `.env.example` — template for secrets

## Step 4: Generate secrets and fill in the .env file

Back on the server:

```bash
cd /opt/franklin-n8n

# Generate strong secrets
echo "N8N_BASIC_AUTH_PASSWORD=$(openssl rand -base64 24)"
echo "N8N_ENCRYPTION_KEY=$(openssl rand -base64 32)"
```

Copy those two values somewhere safe. The encryption key especially — if you lose it, every credential stored in n8n becomes unrecoverable.

Now create the actual `.env` file:

```bash
cp .env.example .env
nano .env
```

Fill in every `REPLACE_ME` value. The ones you need now:

- `N8N_HOST` — e.g. `n8n.creaitos.com`
- `N8N_BASIC_AUTH_USER` — `maurice` is fine
- `N8N_BASIC_AUTH_PASSWORD` — paste the generated one
- `N8N_ENCRYPTION_KEY` — paste the generated one
- `BROWSER_USE_API_KEY` — from `cloud.browser-use.com/billing`
- `ANTHROPIC_API_KEY` — from `console.anthropic.com/settings/keys`
- `GHL_API_KEY` — from CreaitOS sub-account: Settings → Private Integrations → Create New
- `GHL_LOCATION_ID` — Settings → Business Profile → Company ID (it's a UUID)
- `PROWRITERS_USERNAME` and `PROWRITERS_PASSWORD` — Sabrina's broker creds

Save and exit (Ctrl+X, then Y, then Enter).

## Step 5: Lock down the .env file

```bash
chmod 600 .env
ls -la .env
# Should show: -rw------- (only root can read)
```

## Step 6: Start the stack

```bash
docker compose up -d
```

This pulls the n8n and Caddy images, creates volumes for persistent data, and starts everything in the background.

Watch the logs to confirm both services started cleanly:

```bash
docker compose logs -f
# Press Ctrl+C to exit log streaming
```

You should see:
- Caddy obtaining a Let's Encrypt certificate for your domain
- n8n initializing the database and starting on port 5678

If Caddy fails to get a cert, the most likely cause is DNS — verify your A record points to the right IP and your firewall allows ports 80 and 443 from anywhere.

## Step 7: Verify n8n is up

In a browser, visit `https://n8n.creaitos.com` (or whatever your host is). You should see:

1. The connection is HTTPS (green padlock, no warnings)
2. A basic auth prompt — log in with `maurice` and your generated password
3. After auth, you land on the n8n setup screen

Complete the n8n owner account setup (separate from basic auth — this is the actual n8n user account). Use a strong password.

## Step 8: Add credentials in n8n

Inside n8n, go to **Credentials → New** and add:

### Credential 1: Browser Use API Key
- **Type**: Header Auth (Generic)
- **Name**: `Browser Use API Key`
- **Header Name**: `Authorization`
- **Header Value**: `Bearer YOUR_BROWSER_USE_API_KEY`

### Credential 2: GHL Private Integration Token
- **Type**: Header Auth (Generic)
- **Name**: `GHL Private Integration Token`
- **Header Name**: `Authorization`
- **Header Value**: `Bearer YOUR_GHL_API_KEY`

These match the credential names referenced in `cyber-quote-bridge.json`.

## Step 9: Import the workflow

From Maurice's local machine:

```bash
# View → Workflows → Import from File
# Select n8n/cyber-quote-bridge.json from the project
```

Or upload via SCP and import from the server's filesystem.

After import, the workflow shows up in your workflows list as "Franklin - Cyber Quote Bridge". It's set to inactive — leave it that way until testing is complete.

## Step 10: Confirm the webhook URL

Click into the workflow → click the **GHL Cyber Form Webhook** node → look at the **Webhook URLs** section.

There are two URLs:
- **Test URL** (for development) — works only when you have the workflow open in test mode
- **Production URL** — the real one, format: `https://n8n.creaitos.com/webhook/cyber-quote-request`

The production URL is what we'll plug into GHL. Save it somewhere — you'll need it for `03-configure-ghl.md`.

## Maintenance commands

While you're SSH'd in, useful things to know:

```bash
# View running containers
docker compose ps

# Stream logs
docker compose logs -f --tail=100

# Restart everything
docker compose restart

# Update n8n to latest version
docker compose pull
docker compose up -d

# Stop the stack (data persists in volumes)
docker compose down

# Total destruction (delete data too — DON'T DO THIS IN PROD)
# docker compose down -v
```

## Backup strategy

n8n stores everything in a SQLite database inside a Docker volume. Back it up regularly:

```bash
# Manual backup
docker run --rm \
  -v franklin-n8n_n8n_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/n8n-$(date +%Y%m%d).tar.gz -C /data .
```

For automated backups, set this up as a cron job AND copy the backups to S3 or Backblaze B2. Encryption key + database = full recovery.

---

Next: `03-configure-ghl.md`
