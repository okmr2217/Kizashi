# GitHub Actions

Kizashiで使用しているGitHub Actionsワークフローの一覧と内容。ワークフローファイルの実体は `.github/workflows/` 配下。

## 一覧

| ファイル | トリガー | 内容 |
|---|---|---|
| `deploy.yml` | `main`へのpush / 手動実行（`workflow_dispatch`） | 3 Workerすべてのビルド・型チェック・D1マイグレーション適用・Cloudflareへのデプロイ |

現状、CI（PR時のlint/typecheck/testの自動実行）は未設定。`development`ブランチやPRへのpushでは何も実行されない。型チェック・テストはローカルで実行してからマージする運用。

## `deploy.yml`

### トリガー

- `main`ブランチへのpush（マージも含む）
- `workflow_dispatch`によるActionsタブからの手動実行

`concurrency`グループ`deploy-production`で同時実行を防止（`cancel-in-progress: false`のため、実行中に新しいpushがあっても現在のジョブは中断されず、完了後に次のジョブが実行される）。

### ジョブ内容（`deploy`, `ubuntu-latest`）

1. `actions/checkout@v4` でチェックアウト
2. `pnpm/action-setup@v4` → `actions/setup-node@v4`（Node.js 22、pnpmキャッシュ有効）
3. `pnpm install --frozen-lockfile`
4. 型チェック（`apps/kizashi-api` → `apps/kizashi-mcp` → `apps/kizashi-web`の順、各`pnpm --filter <pkg> typecheck`）
5. D1マイグレーションをリモートに適用: `pnpm --filter kizashi-api db:migrate:remote`
6. デプロイ（`kizashi-api` → `kizashi-mcp` → `kizashi-web`の順）
   - `kizashi-api`: `pnpm --filter kizashi-api run deploy`（`wrangler deploy`）
   - `kizashi-mcp`: `pnpm --filter kizashi-mcp run deploy`（`wrangler deploy`）
   - `kizashi-web`: `pnpm --filter kizashi-web cf:deploy`（`opennextjs-cloudflare build && opennextjs-cloudflare deploy`）

いずれのステップも失敗すると後続ステップは実行されず、ワークフロー全体が失敗扱いになる（例: 型チェックが落ちればデプロイは実行されない）。

### 必要なRepository Secrets

| Secret名 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers Scripts編集・D1編集権限を持つCloudflare APIトークン |
| `CLOUDFLARE_ACCOUNT_ID` | デプロイ先のCloudflareアカウントID |

`TOKEN_ENCRYPTION_KEY` / `AUTH_SESSION_SECRET` / `THREADS_APP_ID`等、各WorkerのWorkers Secretsはこのワークフローでは一切管理していない。従来通り各Workerに対して `wrangler secret put <NAME>` で個別に設定する（CLAUDE.mdの「デプロイ状況」セクション参照）。

### ハマりどころ

- `apps/kizashi-web`の`typecheck`スクリプトは`next typegen && tsc --noEmit`にしてある。`next build`を経ずに`tsc --noEmit`だけ実行すると、Next.jsが生成する型（`LayoutProps`等、`.next/types`配下）が存在せずTS2304エラーになるため
- `pnpm --filter <pkg> deploy`は package.json の `deploy` スクリプトではなく、pnpmの予約コマンド（workspaceデプロイ機能）として解釈され`ERR_PNPM_INVALID_DEPLOY_TARGET`になる。ワークフロー内では`pnpm --filter <pkg> run deploy`と`run`を明示している

### 実行結果の確認

GitHubリポジトリの「Actions」タブから実行履歴・ログを確認できる。手動実行したい場合は同タブの「Deploy to Cloudflare」ワークフローから「Run workflow」を選択する。

## 今後の検討事項

- PR時のlint/typecheck/test自動実行（CI）は未整備。`packages/kizashi-core` / `apps/kizashi-api` に追加したvitestテスト（`pnpm test`）をCIに組み込む余地がある
- `development`ブランチへのpush時に動く軽量なCI（デプロイはしないtypecheck/test/lintのみ）を別ワークフローとして分離することも検討可能
