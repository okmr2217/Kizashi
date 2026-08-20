import { hasScope, type AuthenticatedApiKey } from "kizashi-core";
import type { Env } from "./env";
import { TOOLS, findTool, ToolError } from "./tools";

const SERVER_INFO = { name: "kizashi-mcp", version: "0.1.0" };
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string };
}

type JsonRpcResponse = JsonRpcSuccess | JsonRpcFailure;

function isNotification(message: JsonRpcRequest): boolean {
  return message.id === undefined;
}

function errorResponse(id: string | number | null, code: number, message: string): JsonRpcFailure {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** 1件のJSON-RPCメッセージを処理する。通知（idなし）の場合はnullを返す */
export async function handleMcpMessage(
  env: Env,
  auth: AuthenticatedApiKey,
  raw: unknown
): Promise<JsonRpcResponse | null> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return errorResponse(null, -32600, "invalid request");
  }
  const message = raw as JsonRpcRequest;
  const id = message.id ?? null;
  const notification = isNotification(message);

  try {
    switch (message.method) {
      case "initialize": {
        const params = (message.params ?? {}) as { protocolVersion?: unknown };
        const protocolVersion =
          typeof params.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL_VERSION;
        const result = {
          protocolVersion,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        };
        return notification ? null : { jsonrpc: "2.0", id, result };
      }

      case "notifications/initialized":
      case "notifications/cancelled":
        return null;

      case "ping":
        return notification ? null : { jsonrpc: "2.0", id, result: {} };

      case "tools/list": {
        const result = {
          tools: TOOLS.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          })),
        };
        return notification ? null : { jsonrpc: "2.0", id, result };
      }

      case "tools/call": {
        const params = (message.params ?? {}) as { name?: unknown; arguments?: unknown };
        const toolName = params.name;
        if (typeof toolName !== "string") {
          return notification ? null : errorResponse(id, -32602, "tool name is required");
        }

        const tool = findTool(toolName);
        if (!tool) {
          return notification ? null : errorResponse(id, -32602, `unknown tool: ${toolName}`);
        }

        if (!hasScope(auth.scopes, tool.scope)) {
          const result = {
            isError: true,
            content: [{ type: "text", text: `insufficient scope: ${tool.scope} is required` }],
          };
          return notification ? null : { jsonrpc: "2.0", id, result };
        }

        try {
          const output = await tool.handler({ env, userId: auth.userId }, params.arguments);
          const result = {
            content: [{ type: "text", text: JSON.stringify(output) }],
          };
          return notification ? null : { jsonrpc: "2.0", id, result };
        } catch (err) {
          const message = err instanceof Error ? err.message : "tool execution failed";
          const result = { isError: true, content: [{ type: "text", text: message }] };
          return notification ? null : { jsonrpc: "2.0", id, result };
        }
      }

      default:
        return notification ? null : errorResponse(id, -32601, `method not found: ${message.method}`);
    }
  } catch (err) {
    if (notification) return null;
    const message = err instanceof ToolError ? err.message : "internal error";
    return errorResponse(id, -32603, message);
  }
}
