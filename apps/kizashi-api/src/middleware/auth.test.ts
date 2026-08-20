import { signSessionToken } from "kizashi-core";
import { Hono } from "hono";
import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { Env } from "../env";
import { requireAuth, SESSION_COOKIE_NAME } from "./auth";

type Variables = { userId: string };

function buildTestApp() {
  const app = new Hono<{ Bindings: Env; Variables: Variables }>();
  app.use("*", requireAuth);
  app.get("/", (c) => c.json({ userId: c.get("userId") }));
  return app;
}

describe("requireAuth", () => {
  it("Cookie未指定の場合は401を返す", async () => {
    const app = buildTestApp();
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(401);
  });

  it("署名が不正なトークンの場合は401を返す", async () => {
    const app = buildTestApp();
    const res = await app.request(
      "/",
      { headers: { Cookie: `${SESSION_COOKIE_NAME}=not-a-valid-jwt` } },
      env
    );
    expect(res.status).toBe(401);
  });

  it("有効なセッショントークンの場合はuserIdをセットして後続処理まで到達する", async () => {
    const token = await signSessionToken(env.AUTH_SESSION_SECRET, { userId: "user_1" }, 3600);
    const app = buildTestApp();
    const res = await app.request(
      "/",
      { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } },
      env
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: "user_1" });
  });

  it("有効期限切れのトークンの場合は401を返す", async () => {
    const token = await signSessionToken(env.AUTH_SESSION_SECRET, { userId: "user_1" }, -1);
    const app = buildTestApp();
    const res = await app.request(
      "/",
      { headers: { Cookie: `${SESSION_COOKIE_NAME}=${token}` } },
      env
    );
    expect(res.status).toBe(401);
  });
});
