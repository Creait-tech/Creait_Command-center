# Browser Automation — ProWriters Cyber Quote

This directory contains the standalone Python script that drives ProWriters via Browser Use Cloud. The same logic is embedded in the n8n workflow, but having the standalone version is critical for debugging.

## When to use this directly (vs n8n)

Use the standalone script when:

- **First-time setup** — confirm Sabrina's ProWriters login works before plugging into the full pipeline
- **ProWriters UI changed** — iterate quickly on the prompt without redeploying n8n
- **n8n bridge failed in prod** — reproduce the exact failure with the same payload
- **Onboarding a new client** with a different broker — use this as the template

Use the n8n workflow when:

- Running in production triggered by GHL webhooks
- You want full execution history, retry logic, error notifications

## Quick start

```bash
# Set up environment
python3 -m venv venv
source venv/bin/activate
pip install browser-use-sdk python-dotenv

# Configure
cp ../docker/.env.example .env
# Fill in BROWSER_USE_API_KEY, PROWRITERS_USERNAME, PROWRITERS_PASSWORD at minimum
nano .env

# Dry run (no API charges, just shows the prompt)
python prowriters_quote.py --test --dry-run

# Real run with built-in test data
python prowriters_quote.py --test

# Real run with custom payload
python prowriters_quote.py --payload my-test-data.json
```

## Files

- **`prowriters_quote.py`** — the script
- **`prompts/prowriters_cyber_task.md`** — the master prompt template, in plain markdown for easy editing
- **`logs/`** — auto-created directory for execution logs (gitignored)

## Cost per run

A successful ProWriters quote run costs roughly:

- $0.01 task initialization
- ~30 agent steps × $0.005 = $0.15 (using Claude Sonnet)
- Total: ~$0.16 per successful run

A failed run that times out costs the same as a successful one. Budget $30-50/month for Sabrina's volume (assume ~10 cyber quotes/week).

## Iterating on the prompt

The natural-language task in `build_prowriters_task()` is what determines whether the agent succeeds. If ProWriters changes their UI or you find the agent making consistent mistakes:

1. Run `--dry-run` first to see the current prompt
2. Edit `build_prowriters_task()` in the script
3. Test with `--test` (real run, watch the session_url live)
4. When the prompt works reliably, sync the change to the n8n workflow:
   - Open n8n → cyber-quote-bridge → "Build ProWriters Task Prompt" node
   - Update the JavaScript code to match
   - Save and test the n8n flow

## Things that break this script

- **Sabrina changes her ProWriters password** — update `.env` and re-run
- **ProWriters adds 2FA** — script can't handle SMS codes; need to switch to authenticated session approach (cookies)
- **ProWriters UI overhaul** — Maurice will need to update the prompt to reference new field names. Watch the live session to identify what's different.
- **Browser Use Cloud goes down** — fall back to running browser-use locally with `use_cloud=False` (slower, less reliable, but works)

## Local-only fallback

If Browser Use Cloud is unavailable, the same code can run on Maurice's local machine with the open-source browser-use library:

```bash
pip install browser-use
uvx browser-use install  # installs Chromium

# Then modify the script to use Browser instead of cloud:
# from browser_use import Agent, Browser
# browser = Browser(use_cloud=False)
# agent = Agent(task=task_prompt, browser=browser)
# await agent.run()
```

This won't have proxy rotation or stealth features, so ProWriters' bot detection might catch it. Use only as emergency fallback.
