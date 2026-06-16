# 01 — VPS Setup (Hetzner)

Time: ~15 minutes. You'll create a $6/month server, point a subdomain at it, and SSH in.

## Why Hetzner

Hetzner Cloud's CPX11 is the best price-to-performance VPS in 2026 for n8n. 2 vCPU AMD, 2GB RAM, 40GB NVMe SSD, 20TB bandwidth, ~$5.83/month. DigitalOcean's equivalent is $12/month. AWS t3.small is $15/month.

If you have a strong preference for DigitalOcean or AWS, use them — these instructions translate directly. The VPS specs and OS choice (Ubuntu 22.04 LTS) are the same.

## Step 1: Create Hetzner Cloud account

1. Go to [hetzner.com/cloud](https://www.hetzner.com/cloud)
2. Sign up (requires payment method, no charge until you provision)
3. Verify email

## Step 2: Add an SSH key

You'll SSH into the server, so set up a key first.

If you don't have an SSH key yet, on Maurice's machine:

```bash
ssh-keygen -t ed25519 -C "maurice@franklin-build"
# Press Enter at all prompts to use defaults
cat ~/.ssh/id_ed25519.pub
```

Copy the entire output (starts with `ssh-ed25519 AAAAC3...`).

In Hetzner Cloud Console:
1. Click your profile → **Security** → **SSH Keys**
2. **Add SSH Key**
3. Paste the public key, name it `maurice-laptop`
4. Save

## Step 3: Create the server

In Hetzner Cloud Console:

1. Click **+ New Project**, name it `franklin-insurance`
2. Inside the project, click **+ Add Server**
3. **Location**: Ashburn, VA (`ash`) — closest to Houston
4. **Image**: Ubuntu 22.04
5. **Type**: Shared vCPU → **CPX11** ($5.83/month)
6. **Networking**: Public IPv4 + IPv6 (default)
7. **SSH Keys**: select the key you added
8. **Firewalls**: skip for now, we'll set this up next
9. **Name**: `franklin-n8n`
10. **Create & Buy now**

The server provisions in ~30 seconds. Note the IPv4 address.

## Step 4: Configure firewall

In Hetzner Cloud Console:

1. **Firewalls** → **Create Firewall**
2. Name: `franklin-firewall`
3. Inbound rules:
   - SSH (port 22) — from your IP only (use `curl -4 ifconfig.co` to get yours)
   - HTTP (port 80) — from anywhere (Caddy needs this for Let's Encrypt challenges)
   - HTTPS (port 443) — from anywhere
4. Apply to server: `franklin-n8n`

This blocks every other port from the internet — the server is locked down.

## Step 5: Point your subdomain at the server

In your DNS provider (GoDaddy if Sabrina's using it, but usually you'd use a separate domain you control for n8n):

1. Add an **A record**:
   - **Name**: `n8n` (or whatever subdomain you want)
   - **Value**: the server's IPv4 address from Step 3
   - **TTL**: 300 (5 min, low so changes propagate fast)

If you use Cloudflare, set it to **DNS only** (gray cloud, NOT proxied) — Caddy needs direct access for Let's Encrypt cert generation.

Verify DNS propagation:

```bash
dig +short n8n.creaitos.com
# Should return the server IPv4
```

If it doesn't return anything, wait 5 minutes and try again.

## Step 6: SSH into the server

From Maurice's machine:

```bash
ssh root@<SERVER_IPV4>
# Type "yes" to accept the host key
```

You're in. The next doc walks you through installing n8n.

## Step 7: Initial server hardening

Quick security baseline before going further:

```bash
# Update everything
apt update && apt upgrade -y

# Install fail2ban (automatic SSH brute-force blocking)
apt install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Set the timezone
timedatectl set-timezone America/Chicago

# Verify
date
# Should show Houston time
```

That's it for the VPS. Server is ready for n8n install.

## Cost transparency

Sabrina is paying $297/mo to CreaitOS, of which a small slice covers the infrastructure. The Hetzner bill goes to Anthropic / your team — it's not billed to her. Same for the Browser Use and Anthropic API usage. She sees one flat fee.

If you're running multiple insurance brokers eventually, you can either:
- Spin up one VPS per client (clean separation, ~$6/mo each)
- Use the same n8n instance for multiple clients (cheaper, requires careful workflow naming)

For Sabrina alone, dedicated VPS is the right call.

---

Next: `02-install-n8n.md`
