import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT || 3000);
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN?.trim();

const app = express();
app.use(express.json({ limit: "4mb" }));

/** Liveness probe. */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", name: "github-mcp", version: "0.1.0" });
});

/**
 * Gate the endpoint with an optional shared secret. When MCP_AUTH_TOKEN is set,
 * callers must present `Authorization: Bearer <token>`.
 */
function authorized(req: Request): boolean {
  if (!MCP_AUTH_TOKEN) return true;
  const header = req.header("authorization") || "";
  const [scheme, value] = header.split(" ");
  return scheme === "Bearer" && value === MCP_AUTH_TOKEN;
}

/**
 * Stateless Streamable HTTP: build a fresh server + transport per request.
 * This works on long-running hosts and on serverless, and avoids cross-request
 * session state. The GitHub token can be overridden per request via the
 * X-GitHub-Token header, otherwise GITHUB_TOKEN is used.
 */
app.post("/mcp", async (req: Request, res: Response) => {
  if (!authorized(req)) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
    return;
  }

  const githubToken = req.header("x-github-token") || undefined;
  const server = createServer(githubToken);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// In stateless mode there is no session to resume or terminate.
const methodNotAllowed = (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed. Use POST for stateless MCP." },
    id: null,
  });
};
app.get("/mcp", methodNotAllowed);
app.delete("/mcp", methodNotAllowed);

app.listen(PORT, () => {
  console.log(`github-mcp listening on http://localhost:${PORT}/mcp`);
  if (!process.env.GITHUB_TOKEN) {
    console.warn("Warning: GITHUB_TOKEN is not set. Tools will require an X-GitHub-Token header.");
  }
  if (!MCP_AUTH_TOKEN) {
    console.warn("Warning: MCP_AUTH_TOKEN is not set. The /mcp endpoint is unauthenticated.");
  }
});
