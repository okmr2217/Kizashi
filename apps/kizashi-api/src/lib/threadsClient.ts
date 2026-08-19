// Threads API (Meta) とのOAuth・プロフィール取得まわりの薄いクライアント。
// 参照: docs/Kizashi 要件定義書 v3.md 「6. Threads API連携の要点」

const AUTHORIZE_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const LONG_LIVED_TOKEN_URL = "https://graph.threads.net/access_token";
const REFRESH_TOKEN_URL = "https://graph.threads.net/refresh_access_token";
const GRAPH_BASE = "https://graph.threads.net/v1.0";

export const THREADS_SCOPES = ["threads_basic", "threads_content_publish", "threads_manage_insights"] as const;

export function buildAuthorizeUrl(params: { appId: string; redirectUri: string; state: string }): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", THREADS_SCOPES.join(","));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", params.state);
  return url.toString();
}

export interface ShortLivedTokenResult {
  access_token: string;
  user_id: string;
}

export async function exchangeCodeForToken(params: {
  appId: string;
  appSecret: string;
  code: string;
  redirectUri: string;
}): Promise<ShortLivedTokenResult> {
  const body = new URLSearchParams({
    client_id: params.appId,
    client_secret: params.appSecret,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
  });
  const res = await fetch(TOKEN_URL, { method: "POST", body });
  if (!res.ok) throw new Error(`threads token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface LongLivedTokenResult {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds, 60日相当
}

export async function exchangeForLongLivedToken(params: {
  appSecret: string;
  shortLivedAccessToken: string;
}): Promise<LongLivedTokenResult> {
  const url = new URL(LONG_LIVED_TOKEN_URL);
  url.searchParams.set("grant_type", "th_exchange_token");
  url.searchParams.set("client_secret", params.appSecret);
  url.searchParams.set("access_token", params.shortLivedAccessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`threads long-lived token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Cronでのトークンリフレッシュ用（Phase 3で使用予定）。60日有効・24時間以上経過していればリフレッシュ可能。
export async function refreshLongLivedToken(params: {
  longLivedAccessToken: string;
}): Promise<LongLivedTokenResult> {
  const url = new URL(REFRESH_TOKEN_URL);
  url.searchParams.set("grant_type", "th_refresh_token");
  url.searchParams.set("access_token", params.longLivedAccessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`threads token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface ThreadsProfile {
  id: string;
  username?: string;
}

export async function fetchThreadsProfile(params: { accessToken: string }): Promise<ThreadsProfile> {
  const url = new URL(`${GRAPH_BASE}/me`);
  url.searchParams.set("fields", "id,username");
  url.searchParams.set("access_token", params.accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`threads profile fetch failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function createThreadsTextContainer(params: {
  threadsUserId: string;
  accessToken: string;
  text: string;
  replyToId?: string;
}): Promise<{ id: string }> {
  const url = new URL(`${GRAPH_BASE}/${params.threadsUserId}/threads`);
  url.searchParams.set("media_type", "TEXT");
  url.searchParams.set("text", params.text);
  if (params.replyToId) url.searchParams.set("reply_to_id", params.replyToId);
  url.searchParams.set("access_token", params.accessToken);
  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) throw new Error(`threads container creation failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export interface ThreadsPublishingLimit {
  quotaUsage: number;
  quotaTotal: number;
}

// クォータ確認: 予約投稿実行ジョブが投稿前に24時間250投稿上限の残数を確認するために使う。
// 参照: docs/Kizashi 要件定義書 v3.md 「6. Threads API連携の要点」
export async function fetchPublishingLimit(params: {
  threadsUserId: string;
  accessToken: string;
}): Promise<ThreadsPublishingLimit> {
  const url = new URL(`${GRAPH_BASE}/${params.threadsUserId}/threads_publishing_limit`);
  url.searchParams.set("fields", "quota_usage,config");
  url.searchParams.set("access_token", params.accessToken);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`threads publishing limit fetch failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { data: Array<{ quota_usage: number; config: { quota_total: number } }> };
  const entry = body.data[0];
  if (!entry) throw new Error("threads publishing limit response missing data");
  return { quotaUsage: entry.quota_usage, quotaTotal: entry.config.quota_total };
}

export async function publishThreadsContainer(params: {
  threadsUserId: string;
  accessToken: string;
  creationId: string;
}): Promise<{ id: string }> {
  const url = new URL(`${GRAPH_BASE}/${params.threadsUserId}/threads_publish`);
  url.searchParams.set("creation_id", params.creationId);
  url.searchParams.set("access_token", params.accessToken);
  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) throw new Error(`threads publish failed: ${res.status} ${await res.text()}`);
  return res.json();
}
