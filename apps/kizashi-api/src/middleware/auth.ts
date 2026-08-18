import { createMiddleware } from "hono/factory";
import type { Env, AppVariables } from "../types";

/**
 * 独自認証(signup/login)は未実装フェーズのため、暫定的にDEFAULT_USER_IDを
 * リクエストユーザーとして扱う。認証実装時にセッション/APIキー検証へ差し替える。
 */
export const requireUser = createMiddleware<{ Bindings: Env; Variables: AppVariables }>(
  async (c, next) => {
    c.set("userId", c.env.DEFAULT_USER_ID);
    await next();
  }
);
