import { applyD1Migrations } from "cloudflare:test";
import { env } from "cloudflare:workers";

// vitest.config.ts の TEST_MIGRATIONS バインディング（migrations/ 配下のSQL）を
// 各テストワーカー起動時にD1へ適用する。全テストファイル共通のセットアップ。
// applyD1Migrations() は未適用のマイグレーションのみ適用するため複数回呼ばれても安全。
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
