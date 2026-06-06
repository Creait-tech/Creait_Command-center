import { serve } from 'inngest/next'

import { inngest } from '@/lib/inngest'
import { functions } from '@/lib/inngest-functions'

/**
 * Inngest serve endpoint. Inngest pings this URL to register functions and
 * deliver events. Must run on Node.js (the Inngest serve handler relies on
 * Node-only crypto for signature verification, and our functions call into
 * Supabase + Anthropic which both expect Node).
 */
export const { GET, POST, PUT } = serve({ client: inngest, functions })

export const runtime = 'nodejs'
export const maxDuration = 300
