import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { encryptToken, verifyMetaSignedRequest } from "kizashi-core";
import type { Env } from "../env";
import { requireAuth } from "../middleware/auth";
import {
  buildAuthorizeUrl,
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchThreadsProfile,
} from "../lib/threadsClient";

const OAUTH_STATE_COOKIE_NAME = "kizashi_oauth_state";
const OAUTH_STATE_MAX_AGE_SECONDS = 60 * 10;

type Variables = { userId: string };

const threadsAccounts = new Hono<{ Bindings: Env; Variables: Variables }>();

// Metaがユーザーのブラウザセッションを介さず直接呼び出すWebhookのため、
// 以下の requireAuth より前に定義して認証対象から外す。
threadsAccounts.post("/oauth/deauthorize", async (c) => {
  const form = await c.req.parseBody();
  const signedRequest = typeof form.signed_request === "string" ? form.signed_request : null;
  if (!signedRequest) return c.text("missing signed_request", 400);

  const payload = await verifyMetaSignedRequest(c.env.THREADS_APP_SECRET, signedRequest);
  if (!payload || typeof payload.user_id !== "string") return c.text("invalid signed_request", 400);

  await c.env.DB.prepare(
    "UPDATE threads_accounts SET is_active = 0, updated_at = datetime('now') WHERE threads_user_id = ?",
  )
    .bind(payload.user_id)
    .run();

  return c.json({ ok: true });
});

threadsAccounts.post("/oauth/data-deletion", async (c) => {
  const form = await c.req.parseBody();
  const signedRequest = typeof form.signed_request === "string" ? form.signed_request : null;
  if (!signedRequest) return c.text("missing signed_request", 400);

  const payload = await verifyMetaSignedRequest(c.env.THREADS_APP_SECRET, signedRequest);
  if (!payload || typeof payload.user_id !== "string") return c.text("invalid signed_request", 400);

  await c.env.DB.prepare("DELETE FROM threads_accounts WHERE threads_user_id = ?").bind(payload.user_id).run();

  const confirmationCode = crypto.randomUUID();
  return c.json({
    // 削除状況を表示する専用ページは未実装のため、暫定的にonboarding画面を案内する。
    url: `${c.env.FRONTEND_ORIGIN}/onboarding`,
    confirmation_code: confirmationCode,
  });
});

threadsAccounts.use("*", requireAuth);

threadsAccounts.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT id, threads_user_id, display_name, token_expires_at, is_active, created_at FROM threads_accounts WHERE user_id = ?",
  )
    .bind(userId)
    .all();
  return c.json({ accounts: results });
});

threadsAccounts.get("/oauth/start", async (c) => {
  const state = crypto.randomUUID();
  setCookie(c, OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  });

  const url = buildAuthorizeUrl({
    appId: c.env.THREADS_APP_ID,
    redirectUri: c.env.THREADS_REDIRECT_URI,
    state,
  });
  return c.redirect(url, 302);
});

threadsAccounts.get("/oauth/callback", async (c) => {
  const userId = c.get("userId");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const expectedState = getCookie(c, OAUTH_STATE_COOKIE_NAME);
  deleteCookie(c, OAUTH_STATE_COOKIE_NAME, { path: "/" });

  if (!code || !state || !expectedState || state !== expectedState) {
    return c.redirect(`${c.env.FRONTEND_ORIGIN}/onboarding?error=1`, 302);
  }

  try {
    const shortLived = await exchangeCodeForToken({
      appId: c.env.THREADS_APP_ID,
      appSecret: c.env.THREADS_APP_SECRET,
      code,
      redirectUri: c.env.THREADS_REDIRECT_URI,
    });
    const longLived = await exchangeForLongLivedToken({
      appSecret: c.env.THREADS_APP_SECRET,
      shortLivedAccessToken: shortLived.access_token,
    });
    const profile = await fetchThreadsProfile({
      accessToken: longLived.access_token,
    });

    const encrypted = await encryptToken(c.env.TOKEN_ENCRYPTION_KEY, longLived.access_token);
    const tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000).toISOString();

    const existing = await c.env.DB.prepare(
      "SELECT id FROM threads_accounts WHERE user_id = ? AND threads_user_id = ?",
    )
      .bind(userId, profile.id)
      .first<{ id: string }>();

    let accountId: string;
    if (existing) {
      accountId = existing.id;
      await c.env.DB.prepare(
        "UPDATE threads_accounts SET display_name = ?, access_token_encrypted = ?, token_expires_at = ?, is_active = 1, updated_at = datetime('now') WHERE id = ?",
      )
        .bind(profile.username ?? null, encrypted, tokenExpiresAt, accountId)
        .run();
    } else {
      accountId = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO threads_accounts (id, user_id, threads_user_id, display_name, access_token_encrypted, token_expires_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
        .bind(accountId, userId, profile.id, profile.username ?? null, encrypted, tokenExpiresAt)
        .run();
    }

    return c.redirect(`${c.env.FRONTEND_ORIGIN}/onboarding?connected=1`, 302);
  } catch (err) {
    console.error("threads oauth callback failed", err);
    return c.redirect(`${c.env.FRONTEND_ORIGIN}/onboarding?error=1`, 302);
  }
});

threadsAccounts.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("DELETE FROM threads_accounts WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

export default threadsAccounts;
