/**
 * Bearer-token auth middleware.
 *
 * Compares the incoming `Authorization: Bearer <token>` header against the
 * configured MCP_TOKEN. Responds 401 on missing or mismatched tokens.
 *
 * Use timing-safe comparison to avoid leaking token length / contents via
 * timing side-channel.
 */
import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export function requireBearer(token: string): RequestHandler {
  if (!token) {
    // Fail closed: if no token is configured, every request must be rejected.
    return (_req, res) => {
      res.status(503).json({
        error: "MCP_TOKEN_NOT_CONFIGURED",
        message: "MCP server is missing the MCP_TOKEN env var.",
      });
    };
  }

  const expected = Buffer.from(`Bearer ${token}`);

  return (req, res, next) => {
    const header = req.header("authorization") ?? "";
    const got = Buffer.from(header);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    next();
  };
}
