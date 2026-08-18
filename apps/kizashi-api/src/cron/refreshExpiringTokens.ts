// トークンリフレッシュジョブ。
// 60日有効期限が切れる前に長期トークンをリフレッシュする。
// Threads APIの仕様上、リフレッシュ可能になるのは発行/前回リフレッシュから24時間以上経過後のため、
// その条件も満たすアカウントのみを対象にする。
// 参照: docs/Kizashi 要件定義書 v3.md 「3.5 アカウント管理」
import { decryptToken, encryptToken } from "kizashi-core";
import type { Env } from "../env";
import { refreshLongLivedToken } from "../lib/threadsClient";

interface ThreadsAccountRow {
  id: string;
  access_token_encrypted: string;
}

const REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000; // 期限の7日前からリフレッシュ対象
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000; // 前回更新から24時間経過していないとリフレッシュ不可

export async function refreshExpiringTokensJob(env: Env): Promise<void> {
  const now = Date.now();
  const expiresBefore = new Date(now + REFRESH_MARGIN_MS).toISOString();
  const updatedBefore = new Date(now - MIN_TOKEN_AGE_MS).toISOString();

  const { results: accounts } = await env.DB.prepare(
    `SELECT id, access_token_encrypted FROM threads_accounts
     WHERE is_active = 1 AND token_expires_at <= ? AND updated_at <= ?`
  )
    .bind(expiresBefore, updatedBefore)
    .all<ThreadsAccountRow>();

  for (const account of accounts) {
    try {
      const accessToken = await decryptToken(env.TOKEN_ENCRYPTION_KEY, account.access_token_encrypted);
      const refreshed = await refreshLongLivedToken({ longLivedAccessToken: accessToken });
      const encrypted = await encryptToken(env.TOKEN_ENCRYPTION_KEY, refreshed.access_token);
      const nowIso = new Date().toISOString();
      const tokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();

      await env.DB.prepare(
        `UPDATE threads_accounts SET access_token_encrypted = ?, token_expires_at = ?, updated_at = ? WHERE id = ?`
      )
        .bind(encrypted, tokenExpiresAt, nowIso, account.id)
        .run();
    } catch (err) {
      console.error(`token refresh failed for threads_account ${account.id}: ${String(err)}`);
    }
  }
}
