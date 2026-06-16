import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOctokit } from "./github.js";
import { registerMetaTools } from "./tools/meta.js";
import { registerRepoTools } from "./tools/repos.js";
import { registerFileTools } from "./tools/files.js";
import { registerIssueTools } from "./tools/issues.js";
import { registerPullTools } from "./tools/pulls.js";
import { registerSearchTools } from "./tools/search.js";

/**
 * Build a fully-configured MCP server for a single request.
 *
 * `token` is the GitHub token to act with (per-request header or undefined to
 * fall back to GITHUB_TOKEN). We build the Octokit client lazily so that an
 * auth-only tool list (e.g. tools/list) never requires a token.
 */
export function createServer(token?: string): McpServer {
  const server = new McpServer({
    name: "github-mcp",
    version: "0.1.0",
  });

  const client = () => getOctokit(token);

  registerMetaTools(server, client);
  registerRepoTools(server, client);
  registerFileTools(server, client);
  registerIssueTools(server, client);
  registerPullTools(server, client);
  registerSearchTools(server, client);

  return server;
}
