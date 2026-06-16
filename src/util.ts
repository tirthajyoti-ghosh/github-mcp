import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** Wrap any value as a text tool result (JSON-encoded unless already a string). */
export function result(data: unknown): CallToolResult {
  const text = typeof data === "string" ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: "text", text }] };
}

/** Wrap an error as an isError tool result so the model sees what went wrong. */
export function errorResult(err: unknown): CallToolResult {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

/**
 * Run a tool handler with uniform error handling. GitHub/network errors are
 * turned into isError results instead of crashing the request.
 */
export function handle<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  return fn().then(result).catch(errorResult);
}
