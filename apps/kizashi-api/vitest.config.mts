import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrationsPath = path.join(import.meta.dirname, "migrations");
  const migrations = await readD1Migrations(migrationsPath);

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            // マイグレーション適用用のテスト専用バインディング（setupFilesで使用）
            TEST_MIGRATIONS: migrations,
            TOKEN_ENCRYPTION_KEY: "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=",
            AUTH_SESSION_SECRET: "test-session-secret",
            THREADS_APP_ID: "test-app-id",
            THREADS_APP_SECRET: "test-app-secret",
            THREADS_REDIRECT_URI: "http://localhost:8787/threads-accounts/oauth/callback",
            FRONTEND_ORIGIN: "http://localhost:3000",
            ANTHROPIC_API_KEY: "test-anthropic-key",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./src/test/applyMigrations.ts"],
    },
  };
});
