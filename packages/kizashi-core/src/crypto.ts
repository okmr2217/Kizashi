// AES-GCM暗号化（Threadsアクセストークン用）、パスワードハッシュ、セッションJWTの自前実装。
// いずれもWeb Crypto APIのみに依存し、外部npmパッケージは追加しない。

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function importAesKey(base64Key: string): Promise<CryptoKey> {
  const raw = fromBase64Url(base64Key.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

// TOKEN_ENCRYPTION_KEY は base64エンコードされた32byteキーを想定（例: openssl rand -base64 32）。
export async function encryptToken(base64Key: string, plaintext: string): Promise<string> {
  const key = await importAesKey(base64Key);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${toBase64Url(iv)}:${toBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptToken(base64Key: string, encoded: string): Promise<string> {
  const [ivPart, ciphertextPart] = encoded.split(":");
  if (!ivPart || !ciphertextPart) throw new Error("invalid encrypted token format");
  const key = await importAesKey(base64Key);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(ciphertextPart),
  );
  return new TextDecoder().decode(plaintext);
}

const PBKDF2_ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  const salt = fromBase64Url(parts[2]);
  const expected = fromBase64Url(parts[3]);
  const actual = await pbkdf2(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return new Uint8Array(bits);
}

// 最小限の自前JWT（HS256）実装。ライブラリ追加を避けるため、セッション用途に限定した簡易版。
export async function signSessionToken(
  secret: string,
  payload: Record<string, unknown>,
  expSeconds: number,
): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const exp = Math.floor(Date.now() / 1000) + expSeconds;
  const body = { ...payload, exp };
  const headerPart = toBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadPart = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const signature = await hmacSign(secret, `${headerPart}.${payloadPart}`);
  return `${headerPart}.${payloadPart}.${signature}`;
}

export async function verifySessionToken<T = Record<string, unknown>>(
  secret: string,
  token: string,
): Promise<T | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerPart, payloadPart, signaturePart] = parts;
  const expectedSignature = await hmacSign(secret, `${headerPart}.${payloadPart}`);
  if (expectedSignature !== signaturePart) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))) as T & { exp?: number };
  if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(signature));
}

// Meta(Facebook/Threads)のDeauthorize/Data Deletion Callback向けsigned_request検証。
// 形式: base64url(HMAC-SHA256署名).base64url(JSONペイロード)。署名はappSecretをキーに
// エンコード済みpayload文字列(デコード前)に対して計算する。
// 参照: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/
export async function verifyMetaSignedRequest(
  appSecret: string,
  signedRequest: string,
): Promise<Record<string, unknown> | null> {
  const [encodedSig, encodedPayload] = signedRequest.split(".");
  if (!encodedSig || !encodedPayload) return null;

  const expectedSig = await hmacSign(appSecret, encodedPayload);
  if (expectedSig !== encodedSig) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(encodedPayload)));
    if (payload.algorithm !== "HMAC-SHA256") return null;
    return payload;
  } catch {
    return null;
  }
}
