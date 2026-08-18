-- Phase2時点では認証(signup/login)は未実装のため、開発用の単一ユーザーと
-- ダミーThreadsアカウントをseedしておく。認証実装時にこのseedは置き換える。

INSERT INTO users (id, email, password_hash, display_name)
VALUES (
  'user_dev0000000000000000000000000',
  'dev@example.com',
  'unused-until-auth-is-implemented',
  '開発用ユーザー'
);

INSERT INTO threads_accounts (
  id, user_id, threads_user_id, display_name,
  access_token_encrypted, token_expires_at, is_active
)
VALUES (
  'tacct_dev00000000000000000000000',
  'user_dev0000000000000000000000000',
  'dev-threads-user',
  '開発用Threadsアカウント',
  'unused-until-oauth-is-implemented',
  '2999-01-01T00:00:00Z',
  1
);
