import { z } from "zod";
import { generateId } from "./ids";

// 参照: docs/Kizashi 設計書 v1.md 「3. DBスキーマ設計」api_keys / 「6. APIキー発行方針」
export const API_KEY_SCOPES = ["drafts:read", "drafts:write", "projects:read"] as const;
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

const API_KEY_PREFIX = "kzsh_";

export interface ApiKeyRow {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  scopes: string; // JSON配列文字列
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface ApiKeySummary {
  id: string;
  user_id: string;
  name: string;
  scopes: ApiKeyScope[];
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export const createApiKeyInputSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;

export interface ApiKeyDb {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T = unknown>(): Promise<T | null>;
      all<T = unknown>(): Promise<{ results: T[] }>;
    };
  };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

function generateRawApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `${API_KEY_PREFIX}${toHex(bytes)}`;
}

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    scopes: JSON.parse(row.scopes) as ApiKeyScope[],
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    revoked_at: row.revoked_at,
  };
}

/**
 * APIキーを新規発行する。キー本体（rawKey）はこの呼び出し時のみ取得可能で、
 * DBにはSHA-256ハッシュのみを保存する（設計書「3. DBスキーマ設計」api_keys.key_hash）。
 */
export async function createApiKey(
  db: ApiKeyDb,
  userId: string,
  input: CreateApiKeyInput
): Promise<{ apiKey: ApiKeySummary; rawKey: string }> {
  const id = generateId("apikey");
  const rawKey = generateRawApiKey();
  const keyHash = await sha256Hex(rawKey);
  const now = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(id, userId, input.name, keyHash, JSON.stringify(input.scopes), now)
    .run();

  return {
    apiKey: {
      id,
      user_id: userId,
      name: input.name,
      scopes: input.scopes,
      last_used_at: null,
      created_at: now,
      revoked_at: null,
    },
    rawKey,
  };
}

export async function listApiKeys(db: ApiKeyDb, userId: string): Promise<ApiKeySummary[]> {
  const { results } = await db
    .prepare(`SELECT * FROM api_keys WHERE user_id = ? ORDER BY created_at DESC`)
    .bind(userId)
    .all<ApiKeyRow>();
  return results.map(toSummary);
}

/** 失効済み・存在しないキーの場合は false を返す（呼び出し側で404にマッピングする） */
export async function revokeApiKey(db: ApiKeyDb, userId: string, id: string): Promise<boolean> {
  const existing = await db
    .prepare(`SELECT id FROM api_keys WHERE id = ? AND user_id = ? AND revoked_at IS NULL`)
    .bind(id, userId)
    .first();
  if (!existing) return false;

  await db
    .prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ?`)
    .bind(new Date().toISOString(), id, userId)
    .run();
  return true;
}

export interface AuthenticatedApiKey {
  id: string;
  userId: string;
  scopes: ApiKeyScope[];
}

/**
 * kizashi-mcp のスコープ検証ミドルウェアが使う認証本体。
 * 生キーをハッシュ化して照合し、有効なら last_used_at を更新する。
 */
export async function authenticateApiKey(
  db: ApiKeyDb,
  rawKey: string
): Promise<AuthenticatedApiKey | null> {
  if (!rawKey.startsWith(API_KEY_PREFIX)) return null;

  const keyHash = await sha256Hex(rawKey);
  const row = await db
    .prepare(`SELECT * FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL`)
    .bind(keyHash)
    .first<ApiKeyRow>();
  if (!row) return null;

  await db
    .prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), row.id)
    .run();

  return { id: row.id, userId: row.user_id, scopes: JSON.parse(row.scopes) as ApiKeyScope[] };
}

export function hasScope(scopes: ApiKeyScope[], required: ApiKeyScope): boolean {
  return scopes.includes(required);
}
