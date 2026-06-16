# 04 — End-to-End Test

Time: ~30 minutes. The first real test of the whole pipeline. We'll catch all the issues that didn't surface in piece-by-piece testing.

## Pre-flight checklist

Don't proceed until ALL of these are true:

- [ ] n8n is running at `https://n8n.creaitos.com` (or your domain)
- [ ] You can log into n8n with basic auth + n8n owner account
- [ ] Browser Use API key credential exists in n8n
- [ ] GHL Private Integration Token credential exists in n8n
- [ ] The cyber-quote-bridge workflow is imported (still inactive — that's correct)
- [ ] The GHL trigger workflow is built and **published**
- [ ] Sabrina's contact exists and `sabrina_contact_id` Custom Value is set
- [ ] Cyber Initial Intake form is live and accessible
- [ ] You have Sabrina's ProWriters credentials and they're known to work (she should have logged in this week to confirm)

## Test 1: Standalone Python script (skip n8n entirely)

This validates that ProWriters automation works at all, before introducing n8n complexity.

On Maurice's local machine:

```bash
cd browser-automation

# Set up Python environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install browser-use-sdk python-dotenv

# Copy env template (this directory, not docker/)
cp ../docker/.env.example .env

# Edit .env and fill in BROWSER_USE_API_KEY, PROWRITERS_USERNAME, PROWRITERS_PASSWORD
# (you can skip the other vars for this test)
nano .env

# First, dry run — confirms the prompt looks right without burning API credits
python prowriters_quote.py --test --dry-run
```

You should see the full task prompt printed to stdout with `[USERNAME]` and `[PASSWORD]` redacted. Read through it. Does it look right? Are the cyber risk profile questions phrased the way ProWriters would expect?

Now the real run:

```bash
python prowriters_quote.py --test
```

This will:
- Send the task to Browser Use Cloud
- Spin up a browser and run for 5-10 minutes
- Print quote results when done

**While it runs**, you can watch it live. Browser Use returns a `session_url` you can open in your browser to see the agent in action. Useful for debugging.

### Expected outcome

If everything works, you'll see something like:

```
✅ 4 quote(s) returned:

  Beazley: $2,100/yr at $1,000,000 limit
    PDF: https://...
  Tokio Marine HCC: $1,890/yr at $1,000,000 limit
    PDF: https://...
  Coalition: $1,650/yr at $1,000,000 limit
    PDF: https://...
  CFC Underwriting: $2,250/yr at $1,000,000 limit
    PDF: https://...

Submission ID: PW-2026-04-29-XYZ
```

If the agent fails, the log file in `logs/` shows the exact agent trajectory. Open the most recent run, look at `raw_output` to see what the agent's last words were before giving up. Common failures and fixes are in `05-troubleshooting.md`.

### Important: this creates a real submission in ProWriters

The agent doesn't bind, but it does create a quote submission. Don't run this with abandon. Test data is fine, but recognize that ProWriters' system will see "Acme Test Widgets" as a real submission until cleaned up. It's worth letting Sabrina know after this test so she can clean it up in the ProWriters portal if she wants.

## Test 2: Direct webhook call (skip GHL)

Hit n8n's webhook directly to test the full n8n flow without going through GHL.

```bash
# From the project root, edit the test fixture first
nano test-fixtures/sample-ghl-webhook.json
```

Update the two contact IDs:
- `contact_id`: a real test contact ID from GHL (create one if needed — name it "n8n Test")
- `sabrina_internal_contact_id`: Sabrina's actual contact ID

Save. Then:

```bash
# In n8n, ACTIVATE the cyber-quote-bridge workflow first (toggle top-right)

# Then fire the webhook
curl -X POST https://n8n.creaitos.com/webhook/cyber-quote-request \
  -H "Content-Type: application/json" \
  -d @test-fixtures/sample-ghl-webhook.json
```

You should get back within 1-2 seconds:

```json
{"status": "accepted", "message": "Cyber quote request received, processing in background", "contact_id": "..."}
```

This means the webhook accepted the payload and is now processing. The actual ProWriters work happens in the background.

Watch the n8n execution:
- Open the workflow → **Executions** tab
- Click into the running execution
- Step through each node to see what's happening at each stage

When complete (5-10 min later), check:
- The test contact in GHL has updated custom fields:
  - `quoted_carriers` populated
  - `quote_summary` populated
  - `prowriters_submission_id` populated
- Sabrina got an SMS (check her phone)

## Test 3: Real GHL form submission (full pipeline)

Final test. Submit the actual form on the website as if you were a prospect.

1. Open the website in an incognito browser
2. Navigate to /cyber (or wherever the cyber form lives)
3. Fill it out completely with realistic test data
4. Submit
5. Check your email — confirmation should arrive within 60 seconds (this is the Cyber Lead Nurture workflow firing, separate from our bridge)
6. Check the n8n execution log — bridge workflow should have fired
7. Wait 5-10 minutes
8. Check the contact in GHL — quotes should be populated
9. Check Sabrina's phone — success SMS

## What "passing" looks like

```
✓ Form submission creates GHL contact
✓ GHL contact has all custom fields populated
✓ Cyber Lead Nurture workflow fires (sends confirmation email/SMS)
✓ Bridge workflow fires (POSTs to n8n webhook)
✓ n8n returns 202 within 2 seconds
✓ n8n execution shows all nodes ran successfully
✓ ProWriters submission created
✓ Quotes returned and parsed
✓ GHL contact updated with quote data
✓ Sabrina receives success SMS
```

When all 10 are green, Phase 9 is done. The cyber pipeline is fully automated.

## What to do after passing

1. Delete the test contact and the test ProWriters submission
2. Document the working configuration — which version of n8n, which Browser Use model, etc.
3. Brief Sabrina: "Cyber form is now fully automated. Real submissions will come in over the next week — let me know if anything looks weird."
4. Set up monitoring (`05-troubleshooting.md` covers this)

## What to do if it doesn't pass

Don't bash on it. Pick the EARLIEST step that failed and dig into that one before moving on. Most issues are:

1. Wrong field names in the GHL webhook body (typo in `business_name` etc.)
2. Browser Use session timing out (ProWriters quote took >15 min)
3. ProWriters UI changed (their submit button moved)
4. GHL API credentials missing a permission

See `05-troubleshooting.md` for specific diagnostics.

---

Next: `05-troubleshooting.md`
