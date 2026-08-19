-- draft_generation_jobs テーブル作成
-- 参照: docs/Kizashi 設計書 v1.md 「3. DBスキーマ設計」「8. 非同期生成のフロントエンド実装」
-- POST /drafts/generate の非同期ジョブ状態をD1に永続化し、GET /drafts/generate/:jobId でポーリングする

CREATE TABLE draft_generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  threads_account_id TEXT NOT NULL REFERENCES threads_accounts(id),
  group_id TEXT REFERENCES groups(id),
  project_id TEXT REFERENCES projects(id),
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
    -- 'processing' | 'completed' | 'failed'
  progress_message TEXT,
  draft_id TEXT REFERENCES drafts(id),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_draft_generation_jobs_user_id ON draft_generation_jobs(user_id);
