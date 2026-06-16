# 05 — Troubleshooting

When the system breaks (and it will, occasionally), here's how to diagnose fast.

## The decision tree

Start here when something fails:

```
Did the GHL form submission create a contact?
├─ NO  → Form/contact issue. See "Form submission failures"
└─ YES → Did the n8n webhook execution show up?
         ├─ NO  → Webhook connection issue. See "Webhook not firing"
         └─ YES → Did the n8n execution complete successfully?
                  ├─ NO at "Browser Use" node → See "Browser Use failures"
                  ├─ NO at "Update GHL" node  → See "GHL API failures"
                  └─ YES → Did Sabrina get the SMS?
                           ├─ NO  → See "SMS not delivered"
                           └─ YES → System working as designed
```

## Form submission failures

**Symptom**: Customer fills out form on website, no contact appears in GHL.

**Diagnose**:
1. In GHL, go to **Sites → Forms → Submissions**. Is the submission there?
2. If yes but no contact: contact creation logic in the form is broken. Check form settings → Advanced → "Add to Contacts: ON".
3. If submission isn't even there: the form on the website isn't submitting. Open the page in incognito, open DevTools Network tab, submit, watch for the POST request to `services.leadconnectorhq.com`.

**Fix**: Usually a missing form field configuration or the form embed code on the website got corrupted. Re-embed the form via the GHL form picker.

## Webhook not firing

**Symptom**: GHL contact gets created, but no execution appears in n8n.

**Diagnose**:
1. In GHL, go to the trigger workflow → **Workflow History**
2. Click the most recent execution
3. Did the Custom Webhook step run? Did it succeed or fail?

If GHL says the webhook returned an error:

- **Connection refused / timeout**: n8n isn't reachable from the public internet. Check:
  ```bash
  # On Maurice's local machine
  curl -I https://n8n.creaitos.com
  ```
  If this fails, your VPS is down or DNS is wrong. SSH in and check `docker compose ps`.

- **DNS resolution failed**: A record is wrong or hasn't propagated. Verify with `dig +short n8n.creaitos.com`.

- **SSL cert error**: Caddy hasn't issued a cert. Check Caddy logs:
  ```bash
  ssh root@server
  cd /opt/franklin-n8n
  docker compose logs caddy | tail -50
  ```
  Most common: Cloudflare proxy is enabled (orange cloud). Set to DNS-only (gray cloud).

- **Webhook 404**: Wrong URL in the GHL action. The path should be exactly `/webhook/cyber-quote-request`. Note: n8n has separate "test" and "production" webhook URLs. Always use production URL when not actively building.

- **Webhook 401**: n8n's webhooks don't require auth, so 401 means Caddy is blocking. Check the Caddyfile — `{$N8N_HOST}` should be your domain.

## Browser Use failures

**Symptom**: n8n execution fails at the "Browser Use - Run ProWriters Task" node.

**Diagnose**:
1. Click into the failed execution
2. Look at the Browser Use node output — what error code?

| Status | Meaning | Fix |
|---|---|---|
| 401 | Bad API key | Regenerate at cloud.browser-use.com, update in n8n credentials |
| 402 | Out of credits | Top up billing on Browser Use Cloud |
| 429 | Rate limited | Add a Wait node before the Browser Use call |
| 500 | Browser Use service issue | Wait 5 minutes, retry. If persistent, check status.browser-use.com |

If the call succeeded but the agent's output is wrong, look at the agent trajectory:
1. Get the `task_id` from the node output
2. Visit `https://cloud.browser-use.com/tasks/{task_id}`
3. Watch the recorded session

**Most common agent failures**:

- **Stuck on login page**: Sabrina's password may have changed, or ProWriters added 2FA. Test the standalone Python script first.

- **Stuck on a form field**: ProWriters changed their UI. Update the prompt in `prowriters_cyber_task.md` to reference the new field names.

- **Returns "no quotes"**: Could be legitimate (carriers genuinely declined) OR the agent gave up too early. Watch the recorded session to confirm.

- **Hits CAPTCHA loop**: ProWriters increased their bot detection. Add `use_proxy: true` (already enabled) and try a different residential proxy region. Last resort: have Sabrina log in manually first to "warm up" the session, then run the agent within 30 minutes.

## GHL API failures

**Symptom**: n8n execution fails at "Update GHL Contact with Quotes" or "Notify Sabrina" nodes.

**Diagnose**:
1. Look at the HTTP response in the failing node
2. Check the response body for the actual error message

| Status | Meaning | Fix |
|---|---|---|
| 401 | Bad/expired token | Regenerate Private Integration Token in GHL, update credential |
| 403 | Token missing permission | Add the required scope in GHL Private Integration settings |
| 404 | Contact ID doesn't exist | Check that GHL passes the right `{{contact.id}}` in the webhook |
| 422 | Invalid field key | Custom field with that key doesn't exist in GHL — create it |
| 429 | Rate limited (100/10sec or 200k/day) | Unlikely at Sabrina's volume; add a Wait node if it happens |

**Most common GHL failure**: trying to update a custom field that doesn't exist. The keys in the JSON payload (`quoted_carriers`, `quote_summary`, `prowriters_submission_id`) must match custom field keys you created in Phase 2 of the main playbook. If you skipped creating those, create them now.

## SMS not delivered

**Symptom**: Everything else worked, but Sabrina didn't get the SMS.

**Diagnose**:
1. Check her phone (yes, really — sometimes it's just a delivery delay)
2. Check her Sabrina contact in GHL → Conversations tab. Is the message there with status "Sent" or "Failed"?

| Status | Meaning | Fix |
|---|---|---|
| Sent | It was delivered, check phone again | — |
| Pending | A2P 10DLC not approved yet | Wait for Twilio approval (1-7 days) |
| Failed: Carrier blocked | Sabrina's carrier flagged the number | Use a different "from" number |
| Failed: Invalid number | Phone number format wrong | Should be E.164: `+15551234567` |
| Failed: Opt-out | Sabrina replied STOP at some point | She has to reply START to re-enable |

## Monitoring suggestions

Don't wait for things to break. Set these up after passing the end-to-end test:

### Uptime monitoring

Use a free service like Uptime Robot or BetterStack:
- Monitor: `https://n8n.creaitos.com` every 5 minutes
- Alert: Email Maurice + Slack #franklin-alerts when down

### n8n execution alerting

In n8n: **Settings → Workflows → Default error workflow**. Build a small workflow that:
1. Trigger: Error Trigger (catches any unhandled error from any workflow)
2. Action: Send email/Slack with the error trace

### Daily summary

Build an n8n workflow that runs every morning at 8am CT:
1. Trigger: Schedule (cron `0 8 * * *`)
2. Query GHL for all cyber leads from the past 24 hours
3. Email Sabrina: "Yesterday: X new leads, Y quoted, Z manual interventions needed"

This gives her a daily snapshot without needing to log in.

### Browser Use cost tracking

In Browser Use Cloud dashboard, set a monthly spending alert at $50. If you blow past it, something's running too often or failing in a loop.

## When all else fails

If you've tried everything in this doc and a failure persists:

1. **Roll back the workflow** — go to n8n executions, find the last successful run, you can revert from there.

2. **Run the standalone Python script** — strips out n8n and tests just ProWriters. If THAT works but n8n doesn't, the issue is in n8n. If neither works, the issue is in ProWriters or Browser Use.

3. **Manually quote the affected lead** — Sabrina logs into ProWriters and runs the quote herself. Then mark the n8n execution as "manually handled" with a note.

4. **Get help** — Anthropic team (Slack), n8n community forum, Browser Use Discord.

The goal is never "no failures ever." The goal is "failures are caught, Sabrina knows about them, and her business doesn't hinge on the automation being perfect." She has manual fallback always — the system supplements her, doesn't replace her.

---

End of Phase 9 docs. Welcome to production.
