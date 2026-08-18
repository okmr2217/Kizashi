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
}
