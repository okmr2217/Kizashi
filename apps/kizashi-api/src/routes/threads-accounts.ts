import { Hono } from "hono";
import type { Env, AppVariables } from "../types";

/**
 * OAuth連携(Phase1)は未実装。Draft作成フォームのアカウント選択に必要な
 * 一覧取得のみ先行実装する。
 */
export const threadsAccountsRoute = new Hono<{ Bindings: Env; Variables: AppVariables }>();

threadsAccountsRoute.get("/", async (c) => {
  const userId = c.get("userId");
  const { results } = await c.env.DB.prepare(
    "SELECT id, display_name, threads_user_id, is_active FROM threads_accounts WHERE user_id = ? ORDER BY created_at DESC"
  )
    .bind(userId)
    .all();
  return c.json({ threads_accounts: results });
});
