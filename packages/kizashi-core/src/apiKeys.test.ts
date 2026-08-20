import { beforeEach, describe, expect, it } from "vitest";
import {
  authenticateApiKey,
  createApiKey,
  hasScope,
  revokeApiKey,
  listApiKeys,
  type ApiKeyDb,
  type ApiKeyRow,
} from "./apiKeys";

// apiKeys.ts が発行する固定のSQL文字列に対して振る舞うインメモリフェイクD1。
// prepare()に渡されるクエリ文字列の特徴的な部分だけを見て分岐する（実SQLパーサではない）。
class FakeApiKeyDb implements ApiKeyDb {
  rows: ApiKeyRow[] = [];

  prepare(query: string) {
    return {
      bind: (...values: unknown[]) => ({
        run: async () => {
          if (query.includes("INSERT INTO api_keys")) {
            const [id, user_id, name, key_hash, scopes, created_at] = values as string[];
            this.rows.push({
              id,
              user_id,
              name,
              key_hash,
              scopes,
              last_used_at: null,
              created_at,
              revoked_at: null,
            });
          } else if (query.includes("SET revoked_at")) {
            const [revoked_at, id, user_id] = values as string[];
            const row = this.rows.find((r) => r.id === id && r.user_id === user_id);
            if (row) row.revoked_at = revoked_at;
          } else if (query.includes("SET last_used_at")) {
            const [last_used_at, id] = values as string[];
            const row = this.rows.find((r) => r.id === id);
            if (row) row.last_used_at = last_used_at;
          }
          return undefined;
        },
        first: async <T,>() => {
          if (query.includes("revoked_at IS NULL") && query.includes("user_id = ?")) {
            const [id, user_id] = values as string[];
            return (this.rows.find(
              (r) => r.id === id && r.user_id === user_id && r.revoked_at === null
            ) ?? null) as T | null;
          }
          if (query.includes("key_hash = ?")) {
            const [key_hash] = values as string[];
            return (this.rows.find((r) => r.key_hash === key_hash && r.revoked_at === null) ??
              null) as T | null;
          }
          return null;
        },
        all: async <T,>() => {
          if (query.includes("WHERE user_id = ?")) {
            const [user_id] = values as string[];
            return { results: this.rows.filter((r) => r.user_id === user_id) as unknown as T[] };
          }
          return { results: [] as T[] };
        },
      }),
    };
  }
}

let db: FakeApiKeyDb;

beforeEach(() => {
  db = new FakeApiKeyDb();
});

describe("createApiKey", () => {
  it("生キーはkzsh_プレフィックスを持ち、DBには生キーと一致しないハッシュのみ保存される", async () => {
    const { apiKey, rawKey } = await createApiKey(db, "user_1", {
      name: "test key",
      scopes: ["drafts:read"],
    });

    expect(rawKey.startsWith("kzsh_")).toBe(true);
    expect(apiKey.name).toBe("test key");
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].key_hash).not.toBe(rawKey);
    expect(JSON.parse(db.rows[0].scopes)).toEqual(["drafts:read"]);
  });
});

describe("listApiKeys", () => {
  it("指定ユーザーのキーのみを返す", async () => {
    await createApiKey(db, "user_1", { name: "key A", scopes: ["drafts:read"] });
    await createApiKey(db, "user_2", { name: "key B", scopes: ["projects:read"] });

    const keys = await listApiKeys(db, "user_1");
    expect(keys).toHaveLength(1);
    expect(keys[0].name).toBe("key A");
  });
});

describe("authenticateApiKey", () => {
  it("正しい生キーでuserIdとscopesを解決し、last_used_atを更新する", async () => {
    const { rawKey } = await createApiKey(db, "user_1", {
      name: "test key",
      scopes: ["drafts:read", "drafts:write"],
    });

    const result = await authenticateApiKey(db, rawKey);
    expect(result).toEqual({ id: db.rows[0].id, userId: "user_1", scopes: ["drafts:read", "drafts:write"] });
    expect(db.rows[0].last_used_at).not.toBeNull();
  });

  it("失効済みのキーはnullを返す", async () => {
    const { apiKey, rawKey } = await createApiKey(db, "user_1", {
      name: "test key",
      scopes: ["drafts:read"],
    });
    await revokeApiKey(db, "user_1", apiKey.id);

    await expect(authenticateApiKey(db, rawKey)).resolves.toBeNull();
  });

  it("プレフィックスが一致しないキーは即座にnullを返す", async () => {
    await expect(authenticateApiKey(db, "not-a-kizashi-key")).resolves.toBeNull();
  });

  it("存在しないキーはnullを返す", async () => {
    await expect(authenticateApiKey(db, "kzsh_deadbeef")).resolves.toBeNull();
  });
});

describe("revokeApiKey", () => {
  it("所有者本人のキーは失効できる", async () => {
    const { apiKey } = await createApiKey(db, "user_1", { name: "test key", scopes: ["drafts:read"] });

    const revoked = await revokeApiKey(db, "user_1", apiKey.id);
    expect(revoked).toBe(true);
    expect(db.rows[0].revoked_at).not.toBeNull();
  });

  it("他ユーザーのキーIDを渡すとfalseを返し、実際には失効しない", async () => {
    const { apiKey } = await createApiKey(db, "user_1", { name: "test key", scopes: ["drafts:read"] });

    const revoked = await revokeApiKey(db, "user_2", apiKey.id);
    expect(revoked).toBe(false);
    expect(db.rows[0].revoked_at).toBeNull();
  });

  it("既に失効済みのキーを再度失効させようとするとfalseを返す", async () => {
    const { apiKey } = await createApiKey(db, "user_1", { name: "test key", scopes: ["drafts:read"] });
    await revokeApiKey(db, "user_1", apiKey.id);

    const secondAttempt = await revokeApiKey(db, "user_1", apiKey.id);
    expect(secondAttempt).toBe(false);
  });
});

describe("hasScope", () => {
  it("スコープが含まれていればtrueを返す", () => {
    expect(hasScope(["drafts:read", "projects:read"], "drafts:read")).toBe(true);
  });

  it("スコープが含まれていなければfalseを返す", () => {
    expect(hasScope(["drafts:read"], "drafts:write")).toBe(false);
  });
});
