import { Hono } from "hono";
import { authenticateApiKey } from "kizashi-core";
import type { Env } from "./env";
import { handleMcpMessage } from "./mcp";

const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.text("kizashi-mcp: ok"));

// MCP Streamable HTTP エンドポイント（ステートレス版：セッションを持たずリクエストごとにJSONで応答する）
// 参照: docs/Kizashi 設計書 v1.md 「5. MCPツール設計（kizashi-mcp）」
// 認証は Authorization: Bearer <APIキー> ヘッダーで行う（POST /api-keys で発行したキー）
app.post("/mcp", async (c) => {
  const authHeader = c.req.header("authorization") ?? "";
  const rawKey = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!rawKey) {
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized: missing API key" } },
      401
    );
  }

  const auth = await authenticateApiKey(c.env.DB, rawKey);
  if (!auth) {
    return c.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "unauthorized: invalid API key" } },
      401
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, 400);
  }

  if (Array.isArray(body)) {
    const responses = (
      await Promise.all(body.map((message) => handleMcpMessage(c.env, auth, message)))
    ).filter((response) => response !== null);
    if (responses.length === 0) return c.body(null, 202);
    return c.json(responses);
  }

  const response = await handleMcpMessage(c.env, auth, body);
  if (response === null) return c.body(null, 202);
  return c.json(response);
});

export default {
  fetch: app.fetch,
};
