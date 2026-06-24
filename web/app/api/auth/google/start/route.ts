import { auth } from '@clerk/nextjs/server'

import { getActiveOrgId } from '@/lib/active-org'

export const runtime = 'nodejs'

/**
 * GET /api/auth/google/start — kick off the Google OAuth consent flow.
 *
 * Redirects the browser to Google's consent screen requesting offline access
 * (so we get a refresh_token) plus the `gmail.send` scope. The active org id
 * and user id are round-tripped through the `state` param so the callback can
 * store the resulting refresh token against the right org.
 *
 * The redirect_uri is derived from the request origin at runtime so the same
 * code works on prod, previews, and localhost without hardcoding.
 */
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const orgId = await getActiveOrgId()

  const origin = new URL(req.url).origin
  const redirectUri = `${origin}/api/auth/google/callback`

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  if (!clientId) {
    return Response.redirect(`${origin}/settings?gmail=missing_config`, 302)
  }

  const state = base64UrlEncode(JSON.stringify({ orgId, userId }))

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: 'openid email https://www.googleapis.com/auth/gmail.send',
    state,
  })

  const consentUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return Response.redirect(consentUrl, 302)
}

/** Base64url-encode a UTF-8 string (no padding). */
function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
