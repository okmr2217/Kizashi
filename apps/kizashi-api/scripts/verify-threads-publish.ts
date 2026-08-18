// 手動検証用スクリプト：D1に保存済みのThreadsアクセストークンを復号し、
// 2ステップ（コンテナ作成→publish）で実際に1件投稿する。
//
// 前提: TOKEN_ENCRYPTION_KEY を環境変数に設定していること（apps/kizashi-api/.dev.vars と同じ値）。
// 使い方:
//   TOKEN_ENCRYPTION_KEY=xxx pnpm --filter kizashi-api run threads:verify-publish -- --account-id <id> --text "test post"

import { execFileSync } from "node:child_process";
import { decryptToken } from "kizashi-core";

function parseArgs(argv: string[]): { accountId: string; text: string } {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key && value) args[key] = value;
  }
  if (!args["account-id"] || !args.text) {
    console.error('usage: threads:verify-publish -- --account-id <id> --text "..."');
    process.exit(1);
  }
  return { accountId: args["account-id"], text: args.text };
}

function fetchAccountRow(accountId: string): { threads_user_id: string; access_token_encrypted: string } {
  const output = execFileSync(
    "wrangler",
    [
      "d1",
      "execute",
      "kizashi-db",
      "--remote",
      "--json",
      "--command",
      `SELECT threads_user_id, access_token_encrypted FROM threads_accounts WHERE id = '${accountId}'`,
    ],
    { encoding: "utf-8" },
  );
  const parsed = JSON.parse(output);
  const row = parsed[0]?.results?.[0];
  if (!row) throw new Error(`threads_accounts row not found for id=${accountId}`);
  return row;
}

async function main() {
  const { accountId, text } = parseArgs(process.argv.slice(2));
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!encryptionKey) throw new Error("TOKEN_ENCRYPTION_KEY env var is required");

  const row = fetchAccountRow(accountId);
  const accessToken = await decryptToken(encryptionKey, row.access_token_encrypted);

  const createUrl = new URL(`https://graph.threads.net/v1.0/${row.threads_user_id}/threads`);
  createUrl.searchParams.set("media_type", "TEXT");
  createUrl.searchParams.set("text", text);
  createUrl.searchParams.set("access_token", accessToken);
  const createRes = await fetch(createUrl.toString(), { method: "POST" });
  if (!createRes.ok) throw new Error(`container creation failed: ${createRes.status} ${await createRes.text()}`);
  const { id: creationId } = (await createRes.json()) as { id: string };
  console.log(`container created: ${creationId}`);

  console.log("waiting 30s before publish (Threads API recommendation)...");
  await new Promise((resolve) => setTimeout(resolve, 30_000));

  const publishUrl = new URL(`https://graph.threads.net/v1.0/${row.threads_user_id}/threads_publish`);
  publishUrl.searchParams.set("creation_id", creationId);
  publishUrl.searchParams.set("access_token", accessToken);
  const publishRes = await fetch(publishUrl.toString(), { method: "POST" });
  if (!publishRes.ok) throw new Error(`publish failed: ${publishRes.status} ${await publishRes.text()}`);
  const { id: postId } = (await publishRes.json()) as { id: string };

  console.log(`published: threads_post_id=${postId}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
