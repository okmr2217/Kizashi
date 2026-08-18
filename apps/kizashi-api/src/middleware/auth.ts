import type { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import { verifySessionToken } from "kizashi-core";
import type { Env } from "../env";

export const SESSION_COOKIE_NAME = "kizashi_session";

type Variables = {
  userId: string;
};

export async function requireAuth(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
) {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) return c.json({ error: "unauthorized" }, 401);

  const payload = await verifySessionToken<{ userId: string }>(c.env.AUTH_SESSION_SECRET, token);
  if (!payload?.userId) return c.json({ error: "unauthorized" }, 401);

  c.set("userId", payload.userId);
  await next();
}
