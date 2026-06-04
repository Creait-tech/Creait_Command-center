/**
 * CREAIT MCP server — STUB for Phase 1.
 * Full implementation arrives in Phase 2 (Second Brain + GHL tools).
 * This stub exposes /health for Traefik and a placeholder /mcp endpoint
 * so the container can be deployed and DNS verified before Phase 2.
 */
import express from "express";

const app = express();
const PORT = Number(process.env.PORT ?? 8080);
const TOKEN = process.env.MCP_TOKEN ?? "";

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", phase: "stub" });
});

app.use((req, res, next) => {
  const auth = req.header("authorization") ?? "";
  if (!TOKEN || auth !== `Bearer ${TOKEN}`) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
});

app.get("/mcp", (_req, res) => {
  res.status(200).json({
    name: "creait-mcp",
    version: "0.1.0",
    phase: "stub",
    tools: [],
  });
});

app.listen(PORT, () => {
  console.log(`creait-mcp stub listening on :${PORT}`);
});
