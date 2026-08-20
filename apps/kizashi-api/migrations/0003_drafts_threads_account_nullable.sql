-- drafts.threads_account_id を NOT NULL から NULL許容へ変更
-- 参照: docs/Kizashi 設計書 v1.md 「1. 複数Threadsアカウント対応」「3. DBスキーマ設計」
-- Draftは作成時にThreadsアカウントへ紐付けない方針に変更。
-- POST /drafts/:id/schedule で予約設定した時点で初めて threads_account_id が確定する。
-- SQLiteはNOT NULL制約を直接ALTERできないためテーブル再構築で対応する。

CREATE TABLE drafts_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  threads_account_id TEXT REFERENCES threads_accounts(id),
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

INSERT INTO drafts_new SELECT * FROM drafts;

DROP TABLE drafts;
ALTER TABLE drafts_new RENAME TO drafts;

CREATE INDEX idx_drafts_user_id ON drafts(user_id);
CREATE INDEX idx_drafts_threads_account_id ON drafts(threads_account_id);
CREATE INDEX idx_drafts_group_id ON drafts(group_id);
CREATE INDEX idx_drafts_status ON drafts(status);
