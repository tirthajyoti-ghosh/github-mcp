import { Octokit } from "@octokit/rest";

/**
 * Resolve a GitHub token and build an Octokit client.
 *
 * Priority: an explicit per-request token (e.g. from the X-GitHub-Token
 * header) overrides the process-wide GITHUB_TOKEN. This keeps the server
 * "thin" and single-user by default, while leaving room for multi-context
 * use where each caller supplies their own token.
 */
export function getOctokit(token?: string): Octokit {
  const auth = token || process.env.GITHUB_TOKEN;
  if (!auth) {
    throw new Error(
      "No GitHub token available. Set GITHUB_TOKEN on the server or pass an X-GitHub-Token header."
    );
  }
  return new Octokit({ auth, userAgent: "github-mcp/0.1.0" });
}

/** A function the tools call to lazily obtain a client for the current request. */
export type ClientFactory = () => Octokit;
