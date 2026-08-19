export interface Env {
  DB: D1Database;
  // トークン暗号化キー（AES-GCM, base64エンコードされた32byteキー）
  TOKEN_ENCRYPTION_KEY: string;
  // セッションJWT署名用シークレット
  AUTH_SESSION_SECRET: string;
  // Threads(Meta)アプリ設定
  THREADS_APP_ID: string;
  THREADS_APP_SECRET: string;
  THREADS_REDIRECT_URI: string;
  // CORS許可オリジン（kizashi-webのURL）
  FRONTEND_ORIGIN: string;
  // 内部AI生成（POST /drafts/generate）用のAnthropic APIキー
  ANTHROPIC_API_KEY: string;
  // 内部AI生成で使うモデルID（未設定時はkizashi-core側のデフォルトを使用）
  ANTHROPIC_MODEL?: string;
}
