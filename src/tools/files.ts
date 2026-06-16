import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ClientFactory } from "../github.js";
import { handle } from "../util.js";

export function registerFileTools(server: McpServer, client: ClientFactory) {
  server.registerTool(
    "get_file_contents",
    {
      title: "Get file contents",
      description:
        "Read a file (or list a directory) from a repository. Returns decoded text for files.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string().describe("Path within the repo, e.g. src/index.ts"),
        ref: z.string().optional().describe("Branch, tag, or commit SHA (defaults to default branch)"),
      },
    },
    ({ owner, repo, path, ref }) =>
      handle(async () => {
        const { data } = await client().repos.getContent({ owner, repo, path, ref });

        // Directory listing
        if (Array.isArray(data)) {
          return data.map((e) => ({ name: e.name, path: e.path, type: e.type, sha: e.sha }));
        }

        // Single file
        if (data.type === "file") {
          const content =
            "content" in data && data.content
              ? Buffer.from(data.content, "base64").toString("utf8")
              : null;
          return { path: data.path, sha: data.sha, size: data.size, content };
        }

        return { path: data.path, type: data.type, sha: data.sha };
      })
  );

  server.registerTool(
    "create_or_update_file",
    {
      title: "Create or update a file",
      description:
        "Create a new file or update an existing one with a commit. To update, you must pass the current file `sha` (get it from get_file_contents).",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        content: z.string().describe("Raw (un-encoded) UTF-8 file content"),
        message: z.string().describe("Commit message"),
        branch: z.string().optional().describe("Target branch (defaults to default branch)"),
        sha: z.string().optional().describe("Required when updating an existing file"),
      },
    },
    ({ owner, repo, path, content, message, branch, sha }) =>
      handle(async () => {
        const { data } = await client().repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content, "utf8").toString("base64"),
          branch,
          sha,
        });
        return {
          commit_sha: data.commit.sha,
          html_url: data.content?.html_url,
          path: data.content?.path,
        };
      })
  );

  server.registerTool(
    "delete_file",
    {
      title: "Delete a file",
      description: "Delete a file with a commit. Requires the current file `sha`.",
      inputSchema: {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        message: z.string().describe("Commit message"),
        sha: z.string().describe("Current file SHA (from get_file_contents)"),
        branch: z.string().optional(),
      },
    },
    ({ owner, repo, path, message, sha, branch }) =>
      handle(async () => {
        const { data } = await client().repos.deleteFile({
          owner,
          repo,
          path,
          message,
          sha,
          branch,
        });
        return { commit_sha: data.commit.sha };
      })
  );
}
