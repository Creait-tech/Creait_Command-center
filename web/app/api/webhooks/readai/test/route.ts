export const runtime = 'nodejs'

/**
 * GET /api/webhooks/readai/test
 *
 * Helper endpoint for local + production smoke tests. Returns a sample
 * Read.ai payload and a curl command Maurice can copy-paste to verify the
 * webhook end-to-end. Does not send the request itself — that would be a
 * proxy hop and obscure auth issues.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const webhookUrl = `${url.origin}/api/webhooks/readai`

  const samplePayload = {
    id: `test-${Date.now()}`,
    meeting: {
      id: `test-meeting-${Date.now()}`,
      title: 'Test Level 10 — Read.ai webhook smoke test',
      start_time: new Date().toISOString(),
    },
    attendees: [
      { name: 'Maurice Grant', email: 'maurice@getcreait.com' },
      { name: 'John Doe', email: 'john@getcreait.com' },
    ],
    recording_url: 'https://app.read.ai/i/test-recording',
    summary: {
      short:
        'Quarterly planning sync. Reviewed Q3 wins, surfaced two blockers, agreed on owner for client journey rollout.',
    },
    transcript: {
      text: [
        'Maurice: Big win this week — we closed Asia for ACE Financial.',
        'John: Nice. Quick issue: GHL sync is dropping calls for the WLF location, we need to debug.',
        'Maurice: Action item — John, take the WLF GHL sync investigation by Friday.',
        'John: Decision — we are moving the Level 10 from Tuesdays to Wednesdays starting next week.',
        'Maurice: Another win — Trembly Bald LaunchBoom prelaunch hit 200 reservations.',
      ].join('\n'),
    },
  }

  const curlExample = [
    `curl -X POST ${webhookUrl} \\`,
    `  -H 'Authorization: Bearer $READAI_WEBHOOK_SECRET' \\`,
    `  -H 'Content-Type: application/json' \\`,
    `  -d '${JSON.stringify(samplePayload)}'`,
  ].join('\n')

  return Response.json(
    {
      webhookUrl,
      samplePayload,
      curl: curlExample,
      notes: [
        'Set READAI_WEBHOOK_SECRET locally before running this curl.',
        'Real Read.ai requests use the X-Readai-Signature header (HMAC-SHA256 of body).',
        'This endpoint just generates the payload + curl — it does not POST.',
      ],
    },
    {
      // Pretty-print so it copy-pastes well from a browser.
      headers: { 'content-type': 'application/json; charset=utf-8' },
    },
  )
}
