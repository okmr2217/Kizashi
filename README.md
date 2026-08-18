# Kizashi（きざし）

Threads投稿のAI生成・リスト管理・予約投稿ツール。

Threads APIを利用し、テーマやコンバージョン最適化の指示に沿ってAIに投稿内容を提案させ、
提案を「Draft」としてリスト管理し、指定日時に予約投稿できるようにするツールです。
複数Threadsアカウント・複数ユーザーでの利用を前提とし、投稿の実測エンゲージメントを
取得してAI生成へフィードバックします。

## できること

- **AI投稿生成**: テーマ・コンバージョン最適化の指示から投稿案をAIに生成させる。生成時は「グループ」と参照する「プロジェクト」を選択でき、同グループ内の過去の高評価／低評価Draftが自動でプロンプトに注入される
- **Draft管理**: 生成された投稿案をリストとして保存・編集・グルーピング・5段階評価
- **予約投稿**: Draftに投稿日時を設定して自動投稿。通常投稿・リプライ投稿の両方に対応し、親投稿の完了をトリガーに子リプライの投稿可否を制御するイベント駆動方式を採用
- **実測エンゲージメント取得**: 投稿後1時間／24時間／72時間／7日後にインプレッション・いいね・返信数などを取得し、AI生成へのフィードバックに活用
- **MCP公開**: Draft・実績データをMCPサーバーとして公開し、Kizashi外のClaude等からも参照・作成できる

## ドキュメント

- 要件定義書: [`docs/Kizashi 要件定義書 v3.md`](docs/Kizashi%20要件定義書%20v3.md)
- 設計書: [`docs/Kizashi 設計書 v1.md`](docs/Kizashi%20設計書%20v1.md)
- UI／UXデザイン方針・デザイントークン: [`docs/design-ui.md`](docs/design-ui.md)
- 開発方針: [`CLAUDE.md`](CLAUDE.md)

実装方針で迷ったら、まずこれらのドキュメントを参照してください。

## モノレポ構成

```
kizashi/
  apps/
    kizashi-web/    # Next.js（フロントエンド）
    kizashi-api/     # Cloudflare Workers（メインAPI・Cron）
    kizashi-mcp/      # Cloudflare Workers（MCPサーバー、別デプロイ）
  packages/
    kizashi-core/    # create_draft等、api/mcp両方から呼ぶ共有ロジック
  docs/
    Kizashi 要件定義書 v3.md
    Kizashi 設計書 v1.md
    design-ui.md
```

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js, Tailwind CSS, shadcn/ui（Vercelデプロイ） |
| バックエンドAPI | Cloudflare Workers（`kizashi-api`） |
| MCPサーバー | Cloudflare Workers（`kizashi-mcp`、`kizashi-api`とは別デプロイ） |
| DB | Cloudflare D1（SQLite） |
| 認証 | Kizashi単体で完結する独自認証 |

`kizashi-api` と `kizashi-mcp` は完全に別Workerとしてデプロイしますが、`create_draft` などの
コアロジックは `packages/kizashi-core` に集約し、両方からimportして使うことで重複を避けています。

## 実装状況

Phaseが完了するごとに [`CLAUDE.md`](CLAUDE.md) の該当セクションを更新しています。

- [ ] Phase 0: 基盤構築
- [ ] Phase 1: Threads連携の疎通確認
- [ ] Phase 2: Draft管理の最小機能
- [ ] Phase 3: 予約投稿の自動実行
- [ ] Phase 4: 実測エンゲージメント取得
- [ ] Phase 5: AI生成（内部）
- [ ] Phase 6: MCP公開・APIキー管理
- [ ] Phase 7: 複数アカウントUI仕上げ
