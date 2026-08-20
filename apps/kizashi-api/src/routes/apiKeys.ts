import { Hono } from "hono";
import { createApiKeyInputSchema, createApiKey, listApiKeys, revokeApiKey } from "kizashi-core";
import type { Env } from "../env";
import { requireAuth } from "../middleware/auth";

type Variables = { userId: string };

const apiKeys = new Hono<{ Bindings: Env; Variables: Variables }>();

apiKeys.use("*", requireAuth);

apiKeys.get("/", async (c) => {
  const userId = c.get("userId");
  const keys = await listApiKeys(c.env.DB, userId);
  return c.json({ api_keys: keys });
});

apiKeys.post("/", async (c) => {
  const userId = c.get("userId");
  const parsed = createApiKeyInputSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);

  const { apiKey, rawKey } = await createApiKey(c.env.DB, userId, parsed.data);
  // rawKeyはこのレスポンスでのみ返す。DB側にはkey_hashのみ保存されるため以後の再表示はできない
  return c.json({ api_key: apiKey, key: rawKey }, 201);
});

apiKeys.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  const revoked = await revokeApiKey(c.env.DB, userId, id);
  if (!revoked) return c.json({ error: "not_found" }, 404);
  return c.body(null, 204);
});

export default apiKeys;
