# CLAUDE.md

Threads投稿のAI生成・リスト管理・予約投稿ツール「Kizashi」。

## ドキュメント
- 要件定義書: `docs/Kizashi 要件定義書 v3.md`
- 設計書: `docs/Kizashi 設計書 v1.md`
- UI／UXデザイン方針・デザイントークン: `docs/design-ui.md`

実装方針で迷ったら、まずこれらを参照すること。仕様の齟齬に気づいた場合はコードを推測で進めず確認する。

## モノレポ構成
```
kizashi/
  apps/
    kizashi-web/    # Next.js（フロントエンド、OpenNext for CloudflareでWorkersにデプロイ）
    kizashi-api/     # Cloudflare Workers（メインAPI・Cron）
    kizashi-mcp/      # Cloudflare Workers（MCPサーバー、別デプロイ）
  packages/
    kizashi-core/    # create_draft等、api/mcp両方から呼ぶ共有ロジック
  docs/
    Kizashi 要件定義書 v3.md
    Kizashi 設計書 v1.md
```

## 技術スタック
- フロントエンド: Next.js, Tailwind CSS, shadcn/ui。`@opennextjs/cloudflare` でビルドし、Cloudflare Workers（`kizashi-web`）にデプロイ（Vercelは使用しない）
- バックエンド: Cloudflare Workers（`kizashi-api` / `kizashi-mcp` は別Workerとしてデプロイするが、`packages/kizashi-core` のロジックを共有する）
- DB: Cloudflare D1（SQLite）
- 認証: このプロダクト単体で完結する独自認証（他Parittoプロダクトとの統合はしない）

## Worker分離の原則
- `kizashi-api` と `kizashi-mcp` はデプロイ単位として完全に別Worker
- ただし `create_draft` などのコアロジックは `packages/kizashi-core` に置き、両方からimportして使う（ロジックの重複を作らない）
- `kizashi-mcp` は外部AI（Claude/ChatGPT）向けの読み取り・書き込みツールを公開する。エンドポイントを増やす際は `docs/Kizashi 設計書 v1.md` のMCPツール表を更新すること

## DBスキーマ
テーブル定義は `docs/Kizashi 設計書 v1.md` の「3. DBスキーマ設計」セクションが正。マイグレーションを書く際は必ずそちらと差分がないか確認する。

現在マイグレーション済みのテーブル（`apps/kizashi-api/migrations/`）:
- `users` / `threads_accounts`（0001）
- `groups` / `projects` / `project_files` / `drafts` / `draft_engagement_snapshots` / `api_keys`（0002）

## 用語
- **Draft**: AIが提案した投稿内容の1件。生成→リスト管理→予約投稿の対象となる単位
- **プロジェクト**: AI生成時に参照させるMarkdownファイル群をまとめる単位（用途は限定しない汎用置き場）
- **グループ**: Draftをテーマ単位でまとめる分類

## 実装上の注意点
- Threadsアクセストークンは必ずD1に暗号化して保存する（復号キーはWorkers Secrets）。平文でログに出さない
- Threads APIの制限（24時間250投稿、レート制限）を超える可能性がある処理には、実行前に `threads_publishing_limit` を確認するガードを入れる
- 予約投稿のリプライ順序制御はイベント駆動方式（親投稿完了→子の投稿可能フラグを立てる）。ポーリングで「時刻だけ」見て投稿しないこと
- `drafts.status` の値は `'draft' | 'scheduled' | 'ready_to_publish' | 'published' | 'failed'` に固定。新しいステータスを増やす場合はdesign.mdも更新する

## コーディング規約
- （プロジェクト固有のLint/フォーマット設定があればここに追記）

## 現在の実装状況
（Phaseが完了するごとにこのセクションを更新する）
- [x] Phase 0: 基盤構築
- [x] Phase 1: Threads連携の疎通確認（独自認証(signup/login/セッションCookie)とThreads OAuth連携（`/threads-accounts/oauth/start` `/callback`）を実装、ローカル/リモートでの疎通確認・実投稿まで完了。ログイン画面のUIは未着手）
- [x] Phase 2: Draft管理の最小機能（groups/projects/project_filesのCRUD、drafts手動作成・編集・削除・評価・一覧フィルタAPI（すべて`requireAuth`によるセッション認証必須）、Draft一覧/詳細画面まで実装。AI生成・予約投稿は未実装）
- [x] Phase 3: 予約投稿の自動実行（`POST /drafts/:id/schedule`、Cron 3種（予約投稿実行ジョブ／親投稿完了検知ジョブ＝セーフティネット／トークンリフレッシュジョブ）を実装。親子リプライの順序制御はイベント駆動：予約投稿実行ジョブが親の投稿成功/失敗を確定した直後にそのジョブ内で直下の子の状態を更新し、親投稿完了検知ジョブはその更新漏れを拾う整合性チェックとして数分おきに再確認する構成。`drafts.status`は既存5値のまま変更なし。`POST /drafts/:id/cancel-schedule`とリプライ側1000件/日上限のガードは未実装）
- [ ] Phase 4: 実測エンゲージメント取得
- [ ] Phase 5: AI生成（内部）
- [ ] Phase 6: MCP公開・APIキー管理
- [ ] Phase 7: 複数アカウントUI仕上げ（`docs/design-ui.md`のデザイントークンをshadcn/uiテーマへ正式統合する作業を含む）

### デプロイ状況
- `kizashi-api` / `kizashi-mcp` / `kizashi-web` の3 Workerとも Cloudflareへデプロイ済み（`https://kizashi-api.okumuradaichi2007.workers.dev` / `https://kizashi-mcp.okumuradaichi2007.workers.dev` / `https://kizashi-web.okumuradaichi2007.workers.dev`）
- `kizashi-web` は `@opennextjs/cloudflare` を導入（`apps/kizashi-web/wrangler.jsonc`, `open-next.config.ts`）。デプロイは `pnpm --filter kizashi-web cf:deploy`
- `kizashi-api` のWorkers Secrets（`TOKEN_ENCRYPTION_KEY` / `AUTH_SESSION_SECRET` / `FRONTEND_ORIGIN`）は設定済み。`THREADS_APP_ID` / `THREADS_APP_SECRET` / `THREADS_REDIRECT_URI` は現状プレースホルダーのため、実際のThreads OAuth連携には正しい値の再設定（`wrangler secret put`）が必要
- `ANTHROPIC_API_KEY`（内部AI生成 `POST /drafts/generate` 用）はローカルと本番で**必ず別キー**を発行して使い分ける（Anthropic Console上で `kizashi-api-local` / `kizashi-api-production` のように用途ごとに分けて発行）。ローカルは `apps/kizashi-api/.dev.vars` の `ANTHROPIC_API_KEY`、本番は `wrangler secret put ANTHROPIC_API_KEY` でそれぞれ設定する（保存場所自体が別なので、値さえ別キーにしておけば漏えい時の影響範囲や利用量の切り分けができる）。取得手順はClipnoteにまとめてある（https://clipnote.paritto.dev/p/8ceecff1-8cd9-48b7-9e80-5006b2307c56）
- `kizashi-mcp` の `wrangler.jsonc` の `database_id` は `kizashi-api` と同じD1 (`kizashi-db`) を指すよう修正済み
- `kizashi-web`のSSR（Draft一覧・詳細）からkizashi-apiを呼ぶ処理は、`*.workers.dev`同士の直接fetchだとCloudflareのエラー1042（Worker間でCloudflare IP宛の直接fetchはブロックされる）が発生するため、`wrangler.jsonc`の`services`バインディング（`API` → `kizashi-api`）経由で呼び出す（`apps/kizashi-web/src/lib/api.ts`の`getServerFetcher`）。ブラウザからの直接呼び出し（ログイン/サインアップ等のクライアントコンポーネント）はこの制約を受けないため通常のfetchのまま

### ログイン/サインアップ画面
- 最小構成のログイン/サインアップ画面を`apps/kizashi-web/src/app/login/page.tsx`に実装済み（メール+パスワードのみ、`docs/design-ui.md`のトンマナに準拠したカスタムUI）。Phase 7で予定している複数アカウント対応・オンボーディングの本実装とは別に、動作確認のため先行実装したもの
- 未ログイン状態で`/drafts`・`/drafts/:id`にアクセスすると`/login`にリダイレクトされる。ログアウトはヘッダーの「ログアウト」ボタンから

### 補足（Draft管理統合時点の暫定事項）
- kizashi-webのDraft一覧・詳細画面は、`docs/design-ui.md`の方向性（温かみのあるニュートラル基調＋グリーン系アクセント）を反映した独自のTailwindトークン（`globals.css`内の`--kz-*`変数、`font-kz-*`/`bg-kz-*`等のユーティリティ）でスタイリングしている。shadcn/ui本体（`components.json`, `ui/button.tsx`等）はBase UIの挙動レイヤーとして温存しており、正式なトークン統合（`--kz-*`を廃止しshadcn標準トークンに一本化する等）はPhase 7で行う想定

---

# Phaseごとのプロンプト設計

Claude Codeへの投げ方は、**Plan Mode前提で「タスクの範囲を明示する」ことが一番効きます**。以下、各Phaseの最初のタスク単位を例に、実際に投げるプロンプト例を示します。

## 基本の型

```
[やりたいこと]を実装したい。

対象: apps/kizashi-api（または該当app）
参照: docs/Kizashi 設計書 v1.md の「[該当セクション名]」

まずPlan Modeで実装方針とタスク分解を出して。
- 影響範囲（新規作成/変更するファイル）
- DBマイグレーションが必要な場合はその内容
- 既存のkizashi-coreとの依存関係

このタスクの範囲外のこと（例: フロントエンドの実装）はやらなくていい。
```

## Phase 0の例（モノレポ雛形＋D1マイグレーション）

```
Kizashiのモノレポを初期化したい。

対象: リポジトリ全体
参照: CLAUDE.md の「モノレポ構成」

以下をPlan Modeでタスク分解して:
1. apps/kizashi-web, apps/kizashi-api, apps/kizashi-mcp, packages/kizashi-core のディレクトリと最小構成
2. kizashi-apiにWrangler設定（D1バインディング含む）
3. usersテーブルとthreads_accountsテーブルのD1マイグレーション（docs/Kizashi 設計書 v1.md のスキーマ通り）

このタスクでは認証ロジックやAPI実装はまだ書かない。雛形と疎通確認まで。
```

## Phase 1の例（Threads OAuth連携）

```
Threads OAuth連携を実装したい。

対象: apps/kizashi-api
参照: docs/Kizashi 設計書 v1.md の「API設計」内 /threads-accounts 関連、
      docs/Kizashi 要件定義書 v3.md の「Threads API連携の要点」

Plan Modeでタスク分解して:
- /threads-accounts/oauth/start, /callback の実装
- アクセストークンの暗号化保存（Workers Secretsのキーを使う想定）
- 動作確認用に、取得したトークンで1件テキスト投稿する検証スクリプトも別途作って

OAuthの実ブラウザ操作・認可は自分で行うので、そこはスクリプト化せず手順だけ教えて。
```

## Phase 3の例（Cron：予約投稿実行）

```
予約投稿の自動実行Cronを実装したい。

対象: apps/kizashi-api
参照: docs/Kizashi 設計書 v1.md の「Cron内部処理」、
      docs/Kizashi 要件定義書 v3.md の「予約投稿機能」（リプライ順序制御の記述）

Plan Modeで方針を出して。特に以下は事前にレビューしたい:
- リプライの順序制御（親投稿完了→can_publish_after_parentを立てる部分）の実装方式
- threads_publishing_limit を確認して250件/日を超えないようにするガードの入れ方
- Cron実行のローカル検証方法（wrangler devでのCron Triggersエミュレーション）

実装は方針レビュー後に進めて。
```

## コツのまとめ
- **「参照ドキュメントのセクション名」を明示する**と、docs/内の該当箇所だけ読ませられるので迷子になりにくい
- **「このタスクの範囲外」を明示的に書く**と、Claude Codeが勝手に隣接領域まで手を広げるのを防げる（特にPhase間の境界が曖昧になりやすいDraft管理まわり）
- Phase 1・Phase 3のような外部API・非同期処理が絡む部分は「Plan Modeで一度立ち止まらせる」指示を毎回入れる
- Phase完了時に「CLAUDE.mdの実装状況チェックボックスを更新して」と一言添えると、ドキュメントが自然に育つ
