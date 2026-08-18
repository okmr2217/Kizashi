# Kizashi 設計書 v2

作成日: 2026-08-19
関連: [Kizashi 要件定義書 v3](https://clipnote.paritto.dev/p/b102955d-350c-4bb4-a576-c2b2a9fb4655)

## 1. 複数Threadsアカウント対応（UI設計）

- Draftは**生成時にThreadsアカウントに紐付ける**（案A採用）
- グループ・プロジェクトはアカウントに紐付けない。アカウント横断で自由に使い回せる設計とし、運用管理はユーザーに委ねる
- ヘッダーにアカウントスイッチャー（ドロップダウン）を配置し、選択中アカウントでDraft一覧・生成をフィルタ
- 全アカウント横断のDraft一覧ビュー（フィルタ「すべて」）も用意する

## 2. 実測エンゲージメントデータ設計

- 取得タイミング：投稿後 **1時間／24時間／72時間／7日後** の4回、スナップショットとして取得
- 7日後の値を「確定値」としてAIフィードバックに使用。以降は再取得しない
- 保存は上書きではなく時系列スナップショット方式（`draft_engagement_snapshots`）
- 取得失敗時は3回までリトライ。それでも失敗したら「実績取得失敗」フラグを立てて通知

## 3. DBスキーマ設計（Cloudflare D1 / SQLite）

### users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### threads_accounts
```sql
CREATE TABLE threads_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  threads_user_id TEXT NOT NULL,
  display_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  token_expires_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, threads_user_id)
);
```
暗号化キーはWorkers Secretsで1本管理し、そのキーでトークンをAES暗号化/復号する。

### groups
```sql
CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### projects
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  default_group_id TEXT REFERENCES groups(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### project_files
```sql
CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### drafts
```sql
CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  threads_account_id TEXT NOT NULL REFERENCES threads_accounts(id),
  group_id TEXT REFERENCES groups(id),
  project_id TEXT REFERENCES projects(id),
  parent_draft_id TEXT REFERENCES drafts(id),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
    -- 'draft' | 'scheduled' | 'ready_to_publish' | 'published' | 'failed'
  rating INTEGER,
  scheduled_at TEXT,
  can_publish_after_parent INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  threads_post_id TEXT,
  failure_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### draft_engagement_snapshots
```sql
CREATE TABLE draft_engagement_snapshots (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL REFERENCES drafts(id),
  snapshot_stage TEXT NOT NULL,  -- '1h' | '24h' | '72h' | '7d'
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  views INTEGER,
  likes INTEGER,
  replies INTEGER,
  reposts INTEGER,
  quotes INTEGER,
  fetch_failed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(draft_id, snapshot_stage)
);
```

### api_keys
```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,               -- 用途表示名（例：「Claude連携用」）
  key_hash TEXT NOT NULL,           -- キー本体はハッシュ化保存
  scopes TEXT NOT NULL,             -- JSON配列（例：["drafts:read","drafts:write"]）
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);
```

## 4. API設計（kizashi-api）

### 認証
| メソッド | パス | 概要 |
|---|---|---|
| POST | `/auth/signup` | ユーザー登録 |
| POST | `/auth/login` | ログイン（トークン発行） |
| POST | `/auth/logout` | ログアウト |

### Threadsアカウント連携
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/threads-accounts` | 連携済みアカウント一覧 |
| GET | `/threads-accounts/oauth/start` | OAuth認可URL発行 |
| GET | `/threads-accounts/oauth/callback` | OAuthコールバック |
| DELETE | `/threads-accounts/:id` | 連携解除 |
| GET | `/threads-accounts/:id/publishing-limit` | Threads側クォータ確認 |

### グループ
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/groups` | 一覧 |
| POST | `/groups` | 作成 |
| PATCH | `/groups/:id` | 更新 |
| DELETE | `/groups/:id` | 削除 |
| GET | `/groups/:id/stats` | 実績サマリー |

### プロジェクト・参照ファイル
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/projects` | 一覧 |
| POST | `/projects` | 作成（default_group_id指定可） |
| PATCH | `/projects/:id` | 更新 |
| DELETE | `/projects/:id` | 削除 |
| GET | `/projects/:id/files` | ファイル一覧 |
| POST | `/projects/:id/files` | ファイル追加 |
| PATCH | `/projects/:id/files/:fileId` | ファイル更新 |
| DELETE | `/projects/:id/files/:fileId` | ファイル削除 |

### Draft
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/drafts` | 一覧（account_id/group_id/status/rating_min等でフィルタ） |
| POST | `/drafts` | 手動作成 |
| GET | `/drafts/:id` | 詳細（評価・実測実績含む） |
| PATCH | `/drafts/:id` | 編集・評価更新 |
| DELETE | `/drafts/:id` | 削除 |
| POST | `/drafts/generate` | AI生成リクエスト（非同期・エージェント的フロー） |
| GET | `/drafts/generate/:jobId` | 生成ジョブのステータス確認（ポーリング用） |
| POST | `/drafts/:id/schedule` | 予約設定 |
| POST | `/drafts/:id/cancel-schedule` | 予約解除 |
| GET | `/drafts/:id/engagement` | 実測エンゲージメントのスナップショット一覧 |

### APIキー
| メソッド | パス | 概要 |
|---|---|---|
| GET | `/api-keys` | 発行済みキー一覧 |
| POST | `/api-keys` | 新規発行（name, scopes指定） |
| DELETE | `/api-keys/:id` | 失効 |

### Cron内部処理（外部非公開）
- 予約投稿実行ジョブ
- 親子リプライ順序制御ジョブ
- トークンリフレッシュジョブ
- エンゲージメントスナップショット取得ジョブ（1h/24h/72h/7d）

## 5. MCPツール設計（kizashi-mcp）

まずClaude向けに実装。ChatGPT対応は安定性を見て後追い。

| ツール名 | 概要 | 必要スコープ |
|---|---|---|
| `list_drafts` | 条件フィルタ済みDraft一覧（軽量版） | `drafts:read` |
| `get_draft` | Draft詳細（本文・評価・全スナップショット） | `drafts:read` |
| `get_group_stats` | グループ単位の実績サマリー | `drafts:read` |
| `list_projects` | プロジェクト一覧＋参照ファイルタイトル一覧 | `projects:read` |
| `get_project_file` | 参照ファイルのMarkdown本文取得 | `projects:read` |
| `create_draft` | Draft新規作成（書き込み系） | `drafts:write` |

### create_draft の実装方針
- コア処理（バリデーション・DB書き込み）は共有パッケージ（`packages/kizashi-core` 想定）に切り出す
- `kizashi-api`（内部AI生成）・`kizashi-mcp`（外部AI向け）の両方から同一ロジックを呼び出す
- Worker自体はデプロイ単位として分離を維持（Clipnoteと同様の方針）。ロジック共有と分離は矛盾しない

### 内部AI生成（`/drafts/generate`）のフロー
1. ユーザーがプロンプト・アカウント・グループ・プロジェクトを指定
2. 内部AIが `list_drafts`（同グループの高評価/低評価Draft）・`get_project_file`（参照ファイル）・`get_group_stats`（実績サマリー）でコンテキスト収集
3. `create_draft` で生成結果を保存
4. 外部のClaude/ChatGPTが同じMCPツールセットを使う場合も同一の生成品質になる設計

## 6. APIキー発行方針

- Clipnote同様、**用途ごとに複数発行**できる設計とする
- スコープは粗い粒度で管理：`drafts:read` / `drafts:write` / `projects:read`
- 内部AI生成（kizashi-api）用は全権限を持つ「システムキー」として別枠管理

## 7. 画面遷移設計

```
ログイン画面
  └→ ダッシュボード（アカウントスイッチャー常設）
       ├→ Draft一覧（フィルタ：グループ/ステータス/評価）
       │    ├→ Draft詳細（本文編集・評価・実測実績グラフ・予約設定）
       │    └→ Draft生成モーダル（プロンプト入力・グループ/プロジェクト選択→生成中表示→生成結果へ）
       ├→ グループ管理（一覧・作成・グループ別実績サマリー画面）
       ├→ プロジェクト管理（一覧・作成・参照ファイルCRUD・デフォルトグループ設定）
       ├→ アカウント連携設定（Threads OAuth連携・解除・トークン状態確認）
       └→ APIキー管理（発行・スコープ設定・失効）
```

- Draft生成は独立画面ではなく**モーダル**（一覧を見ながら都度生成する操作感を優先）
- Draft一覧の「カレンダービュー」切り替えは拡張候補（MVP必須ではない）

## 8. 非同期生成のフロントエンド実装

**ポーリング方式**を採用（MVPフェーズではSSE/WebSocketの実装コストを避ける）。

```
POST /drafts/generate → { job_id, status: "processing" }
GET /drafts/generate/:job_id → { status: "processing" | "completed" | "failed", draft_id?, progress_message? }
```
- `progress_message` に「参考Draftを検索中」「参照ファイルを読み込み中」等の簡易ステータスを持たせ、待ち時間の体感を改善する
- 将来的にUXを磨く段階でSSEへの切り替えを検討

## 9. 残る未決事項
- 実装の着手順序（MVPスコープの優先順位）
