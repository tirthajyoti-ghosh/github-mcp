import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ClientFactory } from "../github.js";
import { handle } from "../util.js";

export function registerOrgTools(server: McpServer, client: ClientFactory) {
  server.registerTool(
    "list_my_orgs",
    {
      title: "List my organizations",
      description:
        "List organizations the authenticated user belongs to. Private memberships require the token to have read:org (classic PAT, SSO-authorized for SAML orgs).",
      inputSchema: {},
    },
    () =>
      handle(async () => {
        const { data } = await client().orgs.listForAuthenticatedUser();
        return data.map((o) => ({ login: o.login, description: o.description, url: o.url }));
      })
  );
}
