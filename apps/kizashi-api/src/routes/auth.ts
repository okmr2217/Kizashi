import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { hashPassword, signSessionToken, verifyPassword } from "kizashi-core";
import type { Env } from "../env";
import { SESSION_COOKIE_NAME } from "../middleware/auth";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7日

const auth = new Hono<{ Bindings: Env }>();

function setSessionCookie(c: Parameters<typeof setCookie>[0], token: string) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

auth.post("/signup", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; display_name?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password || password.length < 8) {
    return c.json({ error: "email and password (8+ chars) are required" }, 400);
  }

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return c.json({ error: "email already registered" }, 409);

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)",
  )
    .bind(id, email, passwordHash, body.display_name ?? null)
    .run();

  const token = await signSessionToken(c.env.AUTH_SESSION_SECRET, { userId: id }, SESSION_MAX_AGE_SECONDS);
  setSessionCookie(c, token);
  return c.json({ id, email }, 201);
});

auth.post("/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  const email = body.email?.trim().toLowerCase();
  const password = body.password;
  if (!email || !password) return c.json({ error: "email and password are required" }, 400);

  const user = await c.env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: "invalid email or password" }, 401);
  }

  const token = await signSessionToken(c.env.AUTH_SESSION_SECRET, { userId: user.id }, SESSION_MAX_AGE_SECONDS);
  setSessionCookie(c, token);
  return c.json({ id: user.id, email });
});

auth.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ ok: true });
});

export default auth;
