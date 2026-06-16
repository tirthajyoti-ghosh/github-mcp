import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ClientFactory } from "../github.js";
import { handle } from "../util.js";

/** Keep repo payloads small: only the fields a model usually needs. */
function trimRepo(r: any) {
  return {
    full_name: r.full_name,
    private: r.private,
    description: r.description,
    default_branch: r.default_branch,
    html_url: r.html_url,
    language: r.language,
    stars: r.stargazers_count,
    open_issues: r.open_issues_count,
    updated_at: r.updated_at,
  };
}

export function registerRepoTools(server: McpServer, client: ClientFactory) {
  server.registerTool(
    "list_my_repos",
    {
      title: "List my repositories",
      description: "List repositories the authenticated user has access to.",
      inputSchema: {
        visibility: z.enum(["all", "public", "private"]).optional(),
        sort: z.enum(["created", "updated", "pushed", "full_name"]).optional(),
        per_page: z.number().int().min(1).max(100).optional().describe("Default 30, max 100"),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ visibility, sort, per_page, page }) =>
      handle(async () => {
        const { data } = await client().repos.listForAuthenticatedUser({
          visibility,
          sort,
          per_page,
          page,
        });
        return data.map(trimRepo);
      })
  );

  server.registerTool(
    "get_repo",
    {
      title: "Get a repository",
      description: "Get metadata for a single repository.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
      },
    },
    ({ owner, repo }) =>
      handle(async () => {
        const { data } = await client().repos.get({ owner, repo });
        return trimRepo(data);
      })
  );

  server.registerTool(
    "list_branches",
    {
      title: "List branches",
      description: "List branches of a repository.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ owner, repo, per_page, page }) =>
      handle(async () => {
        const { data } = await client().repos.listBranches({ owner, repo, per_page, page });
        return data.map((b) => ({ name: b.name, sha: b.commit.sha, protected: b.protected }));
      })
  );

  server.registerTool(
    "list_commits",
    {
      title: "List commits",
      description: "List recent commits on a repository, optionally for a branch or path.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        sha: z.string().optional().describe("Branch name or commit SHA to start from"),
        path: z.string().optional().describe("Only commits touching this path"),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ owner, repo, sha, path, per_page, page }) =>
      handle(async () => {
        const { data } = await client().repos.listCommits({
          owner,
          repo,
          sha,
          path,
          per_page,
          page,
        });
        return data.map((c) => ({
          sha: c.sha,
          message: c.commit.message,
          author: c.commit.author?.name,
          date: c.commit.author?.date,
          html_url: c.html_url,
        }));
      })
  );
}
