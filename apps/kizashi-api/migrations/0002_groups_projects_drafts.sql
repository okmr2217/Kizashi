-- groups, projects, project_files, drafts, draft_engagement_snapshots, api_keys テーブル作成
-- 参照: docs/Kizashi 設計書 v1.md 「3. DBスキーマ設計」
-- users, threads_accounts は 0001_create_users_and_threads_accounts.sql で作成済み

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  default_group_id TEXT REFERENCES groups(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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

CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE INDEX idx_groups_user_id ON groups(user_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_drafts_user_id ON drafts(user_id);
CREATE INDEX idx_drafts_threads_account_id ON drafts(threads_account_id);
CREATE INDEX idx_drafts_group_id ON drafts(group_id);
CREATE INDEX idx_drafts_status ON drafts(status);
CREATE INDEX idx_draft_engagement_snapshots_draft_id ON draft_engagement_snapshots(draft_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
