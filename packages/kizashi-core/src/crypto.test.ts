import { describe, expect, it } from "vitest";
import {
  decryptToken,
  encryptToken,
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from "./crypto";

// openssl rand -base64 32 相当（テスト用固定値）
const TOKEN_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";

describe("encryptToken / decryptToken", () => {
  it("暗号化した値を復号すると平文に戻る", async () => {
    const plaintext = "threads-access-token-xyz";
    const encrypted = await encryptToken(TOKEN_KEY, plaintext);
    expect(encrypted).not.toBe(plaintext);
    await expect(decryptToken(TOKEN_KEY, encrypted)).resolves.toBe(plaintext);
  });

  it("暗号文が改ざんされているとGCMタグ検証に失敗し例外を投げる", async () => {
    const encrypted = await encryptToken(TOKEN_KEY, "some-secret-value");
    const [iv, ciphertext] = encrypted.split(":");
    const tamperedChar = ciphertext[0] === "A" ? "B" : "A";
    const tampered = `${iv}:${tamperedChar}${ciphertext.slice(1)}`;
    await expect(decryptToken(TOKEN_KEY, tampered)).rejects.toThrow();
  });

  it("IVとciphertextの区切り(':')がない不正フォーマットは例外を投げる", async () => {
    await expect(decryptToken(TOKEN_KEY, "not-a-valid-encoded-token")).rejects.toThrow(
      "invalid encrypted token format"
    );
  });
});

describe("hashPassword / verifyPassword", () => {
  it("正しいパスワードで検証成功する", async () => {
    const stored = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("correct-horse-battery-staple", stored)).resolves.toBe(true);
  });

  it("誤ったパスワードでは検証失敗する", async () => {
    const stored = await hashPassword("correct-horse-battery-staple");
    await expect(verifyPassword("wrong-password", stored)).resolves.toBe(false);
  });

  it("フォーマット不正な保存値では検証失敗する", async () => {
    await expect(verifyPassword("any-password", "not-a-pbkdf2-hash")).resolves.toBe(false);
  });
});

describe("signSessionToken / verifySessionToken", () => {
  const SECRET = "session-secret-for-tests";

  it("正しいシークレットで検証に成功しペイロードが一致する", async () => {
    const token = await signSessionToken(SECRET, { userId: "user_1" }, 3600);
    const payload = await verifySessionToken<{ userId: string }>(SECRET, token);
    expect(payload?.userId).toBe("user_1");
  });

  it("誤ったシークレットで検証するとnullを返す", async () => {
    const token = await signSessionToken(SECRET, { userId: "user_1" }, 3600);
    const payload = await verifySessionToken(SECRET + "-wrong", token);
    expect(payload).toBeNull();
  });

  it("有効期限切れのトークンはnullを返す", async () => {
    const token = await signSessionToken(SECRET, { userId: "user_1" }, -1);
    const payload = await verifySessionToken(SECRET, token);
    expect(payload).toBeNull();
  });

  it("ペイロード部分が改ざんされたトークンはnullを返す", async () => {
    const token = await signSessionToken(SECRET, { userId: "user_1" }, 3600);
    const [header, payload, signature] = token.split(".");
    const tamperedPayload = payload.slice(0, -1) + (payload.at(-1) === "A" ? "B" : "A");
    const tampered = `${header}.${tamperedPayload}.${signature}`;
    const result = await verifySessionToken(SECRET, tampered);
    expect(result).toBeNull();
  });
});
