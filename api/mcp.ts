import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN?.trim();

/** Optional shared-secret gate (Authorization: Bearer <MCP_AUTH_TOKEN>). */
function authorized(req: VercelRequest): boolean {
  if (!MCP_AUTH_TOKEN) return true;
  const header = (req.headers["authorization"] as string) || "";
  const [scheme, value] = header.split(" ");
  return scheme === "Bearer" && value === MCP_AUTH_TOKEN;
}

/**
 * Vercel serverless entrypoint for the MCP endpoint.
 *
 * Stateless Streamable HTTP: a fresh server + transport per invocation, which
 * maps cleanly onto serverless functions (no cross-invocation session state).
 * JSON responses are enabled so the function returns a single JSON-RPC payload
 * rather than holding open an SSE stream — friendlier to serverless timeouts.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Stateless mode has no session to resume or terminate.
  if (req.method !== "POST") {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless MCP." },
      id: null,
    });
    return;
  }

  if (!authorized(req)) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
    return;
  }

  const githubToken = (req.headers["x-github-token"] as string) || undefined;
  const server = createServer(githubToken);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

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
}
