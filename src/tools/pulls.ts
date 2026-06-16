import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ClientFactory } from "../github.js";
import { handle } from "../util.js";

function trimPull(p: any) {
  return {
    number: p.number,
    title: p.title,
    state: p.state,
    draft: p.draft,
    user: p.user?.login,
    head: p.head?.ref,
    base: p.base?.ref,
    merged: p.merged,
    mergeable: p.mergeable,
    html_url: p.html_url,
    body: p.body,
  };
}

export function registerPullTools(server: McpServer, client: ClientFactory) {
  server.registerTool(
    "list_pull_requests",
    {
      title: "List pull requests",
      description: "List pull requests in a repository.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        state: z.enum(["open", "closed", "all"]).optional(),
        base: z.string().optional().describe("Filter by base branch"),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ owner, repo, state, base, per_page, page }) =>
      handle(async () => {
        const { data } = await client().pulls.list({ owner, repo, state, base, per_page, page });
        return data.map(trimPull);
      })
  );

  server.registerTool(
    "get_pull_request",
    {
      title: "Get a pull request",
      description: "Get a single pull request by number.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        pull_number: z.number().int(),
      },
    },
    ({ owner, repo, pull_number }) =>
      handle(async () => {
        const { data } = await client().pulls.get({ owner, repo, pull_number });
        return trimPull(data);
      })
  );

  server.registerTool(
    "get_pull_request_files",
    {
      title: "List files in a pull request",
      description: "List the files changed in a pull request, with patch stats.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        pull_number: z.number().int(),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ owner, repo, pull_number, per_page, page }) =>
      handle(async () => {
        const { data } = await client().pulls.listFiles({
          owner,
          repo,
          pull_number,
          per_page,
          page,
        });
        return data.map((f) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
        }));
      })
  );

  server.registerTool(
    "create_pull_request",
    {
      title: "Create a pull request",
      description: "Open a new pull request from head into base.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        head: z.string().describe("The branch with your changes"),
        base: z.string().describe("The branch you want to merge into, e.g. main"),
        body: z.string().optional(),
        draft: z.boolean().optional(),
      },
    },
    ({ owner, repo, title, head, base, body, draft }) =>
      handle(async () => {
        const { data } = await client().pulls.create({
          owner,
          repo,
          title,
          head,
          base,
          body,
          draft,
        });
        return trimPull(data);
      })
  );

  server.registerTool(
    "merge_pull_request",
    {
      title: "Merge a pull request",
      description: "Merge a pull request.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        pull_number: z.number().int(),
        merge_method: z.enum(["merge", "squash", "rebase"]).optional(),
        commit_title: z.string().optional(),
        commit_message: z.string().optional(),
      },
    },
    ({ owner, repo, pull_number, merge_method, commit_title, commit_message }) =>
      handle(async () => {
        const { data } = await client().pulls.merge({
          owner,
          repo,
          pull_number,
          merge_method,
          commit_title,
          commit_message,
        });
        return { merged: data.merged, sha: data.sha, message: data.message };
      })
  );
}
