# Instructions for Claude Code

This file gives Claude Code context when Maurice runs `claude` from the project root.

## Project context

This is the Phase 9 build package for Franklin Insurance Solutions — a CreaitOS / GoHighLevel client. The package automates cyber insurance quoting by bridging GoHighLevel form submissions to the ProWriters broker portal (which has no API) using n8n + Browser Use Cloud.

The actual GoHighLevel build (Phases 1-8) is being done manually by Maurice in the CreaitOS UI. This package is the only part that involves code, and it's specifically the cyber quote bridge.

## Your role

When Maurice runs `claude` in this directory, he likely wants help with one of:

1. **Provisioning a Hetzner VPS** — walk through `docs/01-vps-setup.md`. You can SSH into the VPS he creates and run setup commands, edit configs, etc.

2. **Installing n8n on the VPS** — walk through `docs/02-install-n8n.md`. You'll edit `.env`, run `docker compose up`, verify health.

3. **Configuring the GHL webhook** — `docs/03-configure-ghl.md`. This is GHL UI work; you can't click for him but you can read the docs out loud and answer questions.

4. **Testing the end-to-end flow** — `docs/04-test-end-to-end.md`. You can run `prowriters_quote.py --test` for him and read the logs.

5. **Debugging failures** — `docs/05-troubleshooting.md`. When something breaks, walk the decision tree.

6. **Iterating on the prompt** — when ProWriters changes their UI, the prompt in `browser-automation/prompts/prowriters_cyber_task.md` needs updating. Help Maurice diagnose what changed by watching session logs.

## Things to do when starting

When Maurice first invokes you in this directory:

1. Read `README.md` to confirm context
2. Ask Maurice which step he's on (VPS setup? Testing? Debugging?)
3. Open the relevant doc and walk through it with him

## Things NOT to do

- **Don't modify `cyber-quote-bridge.json` lightly** — it's a tested workflow. If Maurice wants to change behavior, change the prompt or the GHL webhook payload first; only modify the n8n workflow as a last resort.

- **Don't put real credentials in code or in committed files.** Sabrina's ProWriters password, the GHL API key, the Anthropic API key — these all live in the `.env` file (gitignored) on the VPS or on Maurice's local machine. Never paste them into Python files, JSON, or commit messages.

- **Don't bind a real ProWriters policy during testing.** The agent prompt is explicit about this, but if you're modifying the prompt, preserve that constraint. We're requesting quotes only.

- **Don't use Maurice's personal API keys to test things.** If you need to demonstrate something, use placeholder values or read keys from the `.env` file.

## Useful commands

```bash
# SSH into the VPS (after VPS setup is done)
ssh root@<server-ip>

# View running containers on the VPS
ssh root@<server-ip> "cd /opt/franklin-n8n && docker compose ps"

# Stream n8n logs
ssh root@<server-ip> "cd /opt/franklin-n8n && docker compose logs -f n8n"

# Restart n8n after a config change
ssh root@<server-ip> "cd /opt/franklin-n8n && docker compose restart n8n"

# Test ProWriters automation locally (from project root)
cd browser-automation
source venv/bin/activate
python prowriters_quote.py --test --dry-run
```

## When you're stuck

If something fails and you can't figure out why:

1. Read `docs/05-troubleshooting.md` end to end
2. Check the n8n execution log — it shows exactly which node failed and what the error was
3. Watch the Browser Use session recording (URL is in the failed task output)
4. Compare the current ProWriters UI to what the prompt expects
5. Suggest Maurice contact: Anthropic team in Slack, or n8n community forum

## Maintenance reality

This system needs occasional maintenance because ProWriters can change their UI at any time. Realistic expectation: 30 minutes of prompt iteration every 2-3 months. Build that into Sabrina's expectation.

If ProWriters' UI changes drastically (e.g. a complete rebuild), the prompt may need significant rework. Watch a recorded session, identify the new flow, update `prowriters_cyber_task.md`, sync to `prowriters_quote.py` and the n8n workflow.
