import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/auth/google/callback — Google OAuth redirect target.
 *
 * Exchanges the authorization `code` for tokens, extracts the connected Gmail
 * address, and upserts the per-org refresh token into `cc_oauth_tokens` via the
 * service-role client (the only thing that can touch that RLS-locked table).
 *
 * Always redirects back to /settings with a `?gmail=...` status so the UI can
 * surface the outcome. Never throws out to the client.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin
  const settings = (status: string) =>
    Response.redirect(`${origin}/settings?gmail=${status}`, 302)

  try {
    const params = url.searchParams
    const errorParam = params.get('error')
    const code = params.get('code')
    const stateRaw = params.get('state')

    if (errorParam || !code) {
      return settings('denied')
    }

    // Decode state → { orgId, userId }
    let orgId: string | null = null
    let userId: string | null = null
    if (stateRaw) {
      try {
        const decoded = JSON.parse(base64UrlDecode(stateRaw)) as {
          orgId?: string
          userId?: string
        }
        orgId = decoded.orgId ?? null
        userId = decoded.userId ?? null
      } catch {
        return settings('error')
      }
    }
    if (!orgId) {
      return settings('error')
    }

    const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
    const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      return settings('missing_config')
    }

    const redirectUri = `${origin}/api/auth/google/callback`

    // -------------------------------------------------------------------------
    // Exchange the authorization code for tokens
    // -------------------------------------------------------------------------
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    })

    if (!tokenRes.ok) {
      console.error(
        '[auth/google/callback] token exchange failed:',
        tokenRes.status,
        await safeText(tokenRes),
      )
      return settings('error')
    }

    const token = (await tokenRes.json()) as {
      refresh_token?: string
      access_token?: string
      id_token?: string
      scope?: string
    }

    if (!token.refresh_token) {
      // prompt=consent should always return one; if not, surface it.
      return settings('no_refresh')
    }

    // -------------------------------------------------------------------------
    // Resolve the connected Gmail address (id_token first, userinfo fallback)
    // -------------------------------------------------------------------------
    let email: string | null = decodeIdTokenEmail(token.id_token)
    if (!email && token.access_token) {
      try {
        const userinfoRes = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${token.access_token}` } },
        )
        if (userinfoRes.ok) {
          const info = (await userinfoRes.json()) as { email?: string }
          email = info.email ?? null
        }
      } catch (err) {
        console.error('[auth/google/callback] userinfo fetch failed:', err)
      }
    }

    // -------------------------------------------------------------------------
    // Upsert into cc_oauth_tokens (manual upsert on org_id + provider='google')
    // -------------------------------------------------------------------------
    const supabase = createServiceClient()
    const now = new Date().toISOString()

    const { data: existing, error: selectErr } = await supabase
      .from('cc_oauth_tokens')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', 'google')
      .maybeSingle()

    if (selectErr) {
      console.error('[auth/google/callback] token select failed:', selectErr)
      return settings('error')
    }

    if (existing) {
      const { error: updateErr } = await supabase
        .from('cc_oauth_tokens')
        .update({
          email,
          refresh_token: token.refresh_token,
          scopes: token.scope ?? null,
          connected_by: userId,
          updated_at: now,
        })
        .eq('id', existing.id)
      if (updateErr) {
        console.error('[auth/google/callback] token update failed:', updateErr)
        return settings('error')
      }
    } else {
      const { error: insertErr } = await supabase
        .from('cc_oauth_tokens')
        .insert({
          org_id: orgId,
          provider: 'google',
          email,
          refresh_token: token.refresh_token,
          scopes: token.scope ?? null,
          connected_by: userId,
          updated_at: now,
        })
      if (insertErr) {
        console.error('[auth/google/callback] token insert failed:', insertErr)
        return settings('error')
      }
    }

    return settings('connected')
  } catch (err) {
    console.error('[auth/google/callback] error:', err)
    return settings('error')
  }
}

/** Base64url-decode to a UTF-8 string. */
function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64').toString('utf8')
}

/** Pull the `email` claim out of a Google id_token (the JWT middle segment). */
function decodeIdTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null
  try {
    const parts = idToken.split('.')
    if (parts.length < 2) return null
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { email?: string }
    return payload.email ?? null
  } catch {
    return null
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return '<no body>'
  }
}
