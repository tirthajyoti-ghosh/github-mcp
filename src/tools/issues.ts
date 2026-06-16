import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ClientFactory } from "../github.js";
import { handle } from "../util.js";

function trimIssue(i: any) {
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    user: i.user?.login,
    labels: (i.labels || []).map((l: any) => (typeof l === "string" ? l : l.name)),
    comments: i.comments,
    html_url: i.html_url,
    body: i.body,
    is_pull_request: Boolean(i.pull_request),
  };
}

export function registerIssueTools(server: McpServer, client: ClientFactory) {
  server.registerTool(
    "list_issues",
    {
      title: "List issues",
      description: "List issues in a repository. Note: GitHub returns PRs here too unless filtered.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        state: z.enum(["open", "closed", "all"]).optional(),
        labels: z.string().optional().describe("Comma-separated label names"),
        per_page: z.number().int().min(1).max(100).optional(),
        page: z.number().int().min(1).optional(),
      },
    },
    ({ owner, repo, state, labels, per_page, page }) =>
      handle(async () => {
        const { data } = await client().issues.listForRepo({
          owner,
          repo,
          state,
          labels,
          per_page,
          page,
        });
        return data.map(trimIssue);
      })
  );

  server.registerTool(
    "get_issue",
    {
      title: "Get an issue",
      description: "Get a single issue by number.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        issue_number: z.number().int(),
      },
    },
    ({ owner, repo, issue_number }) =>
      handle(async () => {
        const { data } = await client().issues.get({ owner, repo, issue_number });
        return trimIssue(data);
      })
  );

  server.registerTool(
    "create_issue",
    {
      title: "Create an issue",
      description: "Open a new issue.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        title: z.string(),
        body: z.string().optional(),
        labels: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      },
    },
    ({ owner, repo, title, body, labels, assignees }) =>
      handle(async () => {
        const { data } = await client().issues.create({
          owner,
          repo,
          title,
          body,
          labels,
          assignees,
        });
        return trimIssue(data);
      })
  );

  server.registerTool(
    "update_issue",
    {
      title: "Update an issue",
      description: "Edit an issue's title, body, state, labels, or assignees.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        issue_number: z.number().int(),
        title: z.string().optional(),
        body: z.string().optional(),
        state: z.enum(["open", "closed"]).optional(),
        labels: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      },
    },
    ({ owner, repo, issue_number, title, body, state, labels, assignees }) =>
      handle(async () => {
        const { data } = await client().issues.update({
          owner,
          repo,
          issue_number,
          title,
          body,
          state,
          labels,
          assignees,
        });
        return trimIssue(data);
      })
  );

  server.registerTool(
    "add_issue_comment",
    {
      title: "Comment on an issue or PR",
      description: "Add a comment to an issue or pull request (PRs share the issue comment API).",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        issue_number: z.number().int(),
        body: z.string(),
      },
    },
    ({ owner, repo, issue_number, body }) =>
      handle(async () => {
        const { data } = await client().issues.createComment({
          owner,
          repo,
          issue_number,
          body,
        });
        return { id: data.id, html_url: data.html_url };
      })
  );
}
