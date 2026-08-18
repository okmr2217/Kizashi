# Kizashi

Threads投稿のAI生成・リスト管理・予約投稿ツール。

詳細は [CLAUDE.md](./CLAUDE.md) と [docs/](./docs) を参照。

## セットアップ

```bash
pnpm install
```

## kizashi-api（Cloudflare Workers / D1）

```bash
cd apps/kizashi-api
pnpm db:migrate:local   # ローカルD1にマイグレーション適用
pnpm dev                 # http://localhost:8787
```

## kizashi-web（Next.js）

```bash
cd apps/kizashi-web
cp .env.local.example .env.local   # NEXT_PUBLIC_KIZASHI_API_URL を設定
pnpm dev                            # http://localhost:3000
```

## 現状の制約

- 独自認証（signup/login）・Threads OAuth連携は未実装（詳細はCLAUDE.mdの実装状況を参照）
- AI生成機能・予約投稿の自動実行は未実装。手入力でのDraft作成・編集・削除・評価・一覧フィルタのみ利用可能
