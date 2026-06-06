import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Verify a Read.ai webhook signature.
 *
 * Read.ai signs webhook deliveries with HMAC-SHA256 over the raw request
 * body using a shared secret. The hex digest is sent in the
 * `X-Readai-Signature` header.
 *
 * This helper performs a constant-time comparison to defend against timing
 * attacks. Returns `false` for any missing input or malformed signature.
 *
 * @param rawBody   - the exact request body string as received (do NOT
 *                    re-stringify parsed JSON — whitespace changes break
 *                    HMAC verification)
 * @param signature - the value of the `X-Readai-Signature` header
 * @param secret    - the shared webhook secret
 */
export function verifyReadAiSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret || !rawBody) {
    return false
  }

  // Strip optional algorithm prefix some senders include, e.g. "sha256=...".
  const provided = signature.startsWith('sha256=')
    ? signature.slice('sha256='.length)
    : signature

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex')

  // timingSafeEqual requires equal-length Buffers.
  let providedBuf: Buffer
  let expectedBuf: Buffer
  try {
    providedBuf = Buffer.from(provided, 'hex')
    expectedBuf = Buffer.from(expected, 'hex')
  } catch {
    return false
  }

  if (providedBuf.length !== expectedBuf.length) {
    return false
  }

  return timingSafeEqual(providedBuf, expectedBuf)
}
