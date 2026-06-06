import { Inngest } from 'inngest'

/**
 * Singleton Inngest client for the CREAIT Command Center.
 *
 * The id `creait-cc` must stay stable — it's how Inngest groups our function
 * registrations across deployments. Auth/keys are read from
 * `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` env vars by the SDK directly.
 */
export const inngest = new Inngest({ id: 'creait-cc' })
