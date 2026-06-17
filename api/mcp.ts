import type { VercelRequest, VercelResponse } from "@vercel/node";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "../src/server.js";

const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN?.trim();

/**
 * Optional shared-secret gate. Accepts the secret either as
 * `Authorization: Bearer <token>` or as a `?token=<token>` query parameter.
 * The query form exists because some MCP clients (e.g. Claude's custom
 * connector dialog) only let you enter a URL, with no custom headers.
 */
function authorized(req: VercelRequest): boolean {
  if (!MCP_AUTH_TOKEN) return true;
  const header = (req.headers["authorization"] as string) || "";
  const [scheme, value] = header.split(" ");
  if (scheme === "Bearer" && value === MCP_AUTH_TOKEN) return true;
  const q = req.query.token;
  const queryToken = Array.isArray(q) ? q[0] : q;
  return queryToken === MCP_AUTH_TOKEN;
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
  if (!authorized(req)) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: null,
    });
    return;
  }

  // Stateless mode has no session to resume or terminate.
  if (req.method !== "POST") {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless MCP." },
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
