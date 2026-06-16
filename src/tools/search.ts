import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ClientFactory } from "../github.js";
import { handle } from "../util.js";

export function registerSearchTools(server: McpServer, client: ClientFactory) {
  server.registerTool(
    "search_repositories",
    {
      title: "Search repositories",
      description: "Search GitHub repositories using the search syntax, e.g. 'mcp language:typescript'.",
      inputSchema: {
        q: z.string(),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ q, per_page, page }) =>
      handle(async () => {
        const { data } = await client().search.repos({ q, per_page, page });
        return {
          total_count: data.total_count,
          items: data.items.map((r) => ({
            full_name: r.full_name,
            description: r.description,
            stars: r.stargazers_count,
            language: r.language,
            html_url: r.html_url,
          })),
        };
      })
  );

  server.registerTool(
    "search_code",
    {
      title: "Search code",
      description: "Search code across GitHub, e.g. 'addClass in:file language:js repo:owner/name'.",
      inputSchema: {
        q: z.string(),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ q, per_page, page }) =>
      handle(async () => {
        const { data } = await client().search.code({ q, per_page, page });
        return {
          total_count: data.total_count,
          items: data.items.map((c) => ({
            name: c.name,
            path: c.path,
            repository: c.repository.full_name,
            html_url: c.html_url,
          })),
        };
      })
  );

  server.registerTool(
    "search_issues",
    {
      title: "Search issues and pull requests",
      description:
        "Search issues and PRs, e.g. 'repo:owner/name is:open is:issue label:bug'.",
      inputSchema: {
        q: z.string(),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ q, per_page, page }) =>
      handle(async () => {
        const { data } = await client().search.issuesAndPullRequests({ q, per_page, page });
        return {
          total_count: data.total_count,
          items: data.items.map((i) => ({
            number: i.number,
            title: i.title,
            state: i.state,
            repository_url: i.repository_url,
            is_pull_request: Boolean(i.pull_request),
            html_url: i.html_url,
          })),
        };
      })
  );
}
