import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ClientFactory } from "../github.js";
import { handle } from "../util.js";

export function registerMetaTools(server: McpServer, client: ClientFactory) {
  server.registerTool(
    "get_me",
    {
      title: "Get the authenticated user",
      description: "Return the GitHub user the configured token authenticates as. Useful as a connectivity/auth check.",
      inputSchema: {},
    },
    () =>
      handle(async () => {
        const { data } = await client().users.getAuthenticated();
        return {
          login: data.login,
          name: data.name,
          html_url: data.html_url,
          public_repos: data.public_repos,
          private_repos: (data as any).total_private_repos,
        };
      })
  );
}
