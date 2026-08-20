-- drafts テーブルに memo（人間が書くメモ）・ai_memo（AIが書く/読むメモ）カラムを追加
-- 参照: docs/Kizashi 設計書 v1.md 「3. DBスキーマ設計」
-- 両カラムともNULL許容の任意項目。上書き型（履歴は持たない）
-- memo: ユーザーが自由に編集する運用メモ
-- ai_memo: POST /drafts/generate でのAI生成理由・狙い等（任意）。ユーザーも編集可能で、
--          list_drafts/get_draft経由で今後のAI生成のコンテキストとしても読める

ALTER TABLE drafts ADD COLUMN memo TEXT;
ALTER TABLE drafts ADD COLUMN ai_memo TEXT;
