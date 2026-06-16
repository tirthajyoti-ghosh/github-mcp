# github-mcp

A **thin remote MCP server for GitHub**. It exposes a focused set of GitHub
read + write tools over **Streamable HTTP**, so a single deployed URL works from
**Claude on the web, the mobile app, the desktop app, and Claude Code (CLI)** —
acting on your behalf with your GitHub token.

## Why remote (HTTP) instead of stdio?

stdio MCP servers only work where a local process can be launched (desktop /
CLI on your own machine). A remote HTTP server is reachable from *any* Claude
surface via a URL, which is exactly the "from any environment" goal.

## Tools

| Area    | Tools |
| ------- | ----- |
| Meta    | `get_me` |
| Repos   | `list_my_repos`, `get_repo`, `list_branches`, `list_commits` |
| Files   | `get_file_contents`, `create_or_update_file`, `delete_file` |
| Issues  | `list_issues`, `get_issue`, `create_issue`, `update_issue`, `add_issue_comment` |
| Pulls   | `list_pull_requests`, `get_pull_request`, `get_pull_request_files`, `create_pull_request`, `merge_pull_request` |
| Search  | `search_repositories`, `search_code`, `search_issues` |

Responses are trimmed to the fields a model usually needs, to keep token usage low.

## Architecture

- **Stateless Streamable HTTP** (`POST /mcp`): a fresh MCP server + transport is
  built per request. No cross-request session state, so it runs equally well on a
  long-lived host or on serverless.
- **Two auth layers**:
  1. `MCP_AUTH_TOKEN` — optional shared secret gating the endpoint
     (`Authorization: Bearer <token>`). Set this for any public URL.
  2. **GitHub token** — `GITHUB_TOKEN` env (single-user default), overridable
     per request via the `X-GitHub-Token` header (multi-context).
- Thin [Octokit](https://github.com/octokit/octokit.js) wrappers, one module per
  domain under `src/tools/`.

## Quick start (local)

```bash
npm install
cp .env.example .env      # fill in GITHUB_TOKEN and MCP_AUTH_TOKEN
npm run build
npm start                 # listens on http://localhost:3000/mcp
```

Dev mode with reload:

```bash
npm run dev
```

Sanity checks:

```bash
curl http://localhost:3000/health

curl -X POST http://localhost:3000/mcp \
  -H 'Authorization: Bearer YOUR_MCP_AUTH_TOKEN' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

| Variable         | Required | Description |
| ---------------- | -------- | ----------- |
| `GITHUB_TOKEN`   | yes\*    | GitHub PAT used to act on your behalf. Scopes: `repo`, `read:user`. \*Optional if every caller sends `X-GitHub-Token`. |
| `MCP_AUTH_TOKEN` | recommended | Shared secret gating `POST /mcp`. Strongly recommended for any public URL. |
| `PORT`           | no       | HTTP port (default `3000`). |

## Deploy

Any host that runs a Node process and gives you an HTTPS URL works (Render,
Railway, Fly.io, a VPS behind a reverse proxy, etc.):

1. Set `GITHUB_TOKEN` and `MCP_AUTH_TOKEN` as environment variables.
2. Build & run: `npm install && npm run build && npm start`.
3. Note the public URL — your MCP endpoint is `https://<host>/mcp`.

## Connect it to Claude

Add it as a **custom connector / MCP server** pointing at `https://<host>/mcp`.

- **Claude web / desktop**: Settings → Connectors → Add custom connector → URL
  `https://<host>/mcp`. If you set `MCP_AUTH_TOKEN`, add an `Authorization`
  header with value `Bearer <token>`.
- **Claude Code (CLI)**:

  ```bash
  claude mcp add --transport http github https://<host>/mcp \
    --header "Authorization: Bearer YOUR_MCP_AUTH_TOKEN"
  ```

Then ask Claude things like *"list my open PRs in owner/repo"* or
*"open an issue titled … in owner/repo"*.

## Security notes

- The GitHub token grants real write access. Use a fine-grained PAT scoped to
  only the repos you want Claude to touch.
- Always set `MCP_AUTH_TOKEN` and serve over HTTPS when the URL is reachable
  publicly.
- Write tools (`create_*`, `update_*`, `merge_*`, `delete_file`) act
  immediately — there is no dry-run.

## Project layout

```
src/
  index.ts        # HTTP entrypoint (Streamable HTTP, stateless) + auth
  server.ts       # builds the MCP server and registers tools
  github.ts       # Octokit client factory (token resolution)
  util.ts         # tool result + error helpers
  tools/          # one module per GitHub domain
    meta.ts repos.ts files.ts issues.ts pulls.ts search.ts
```
