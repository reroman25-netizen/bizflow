import crypto from "crypto";

const ENC_PREFIX = "enc:v1:";

function getEncryptionKey(): Buffer | null {
  const raw = (process.env.PAYMENT_SECRETS_ENCRYPTION_KEY || "").trim();
  if (!raw) return null;
  // Нормализуем любой секрет из ENV в ровно 32 байта (256 бит) через SHA-256
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Шифрует API-ключ банка алгоритмом AES-256-GCM перед сохранением в БД.
 * Если переменная PAYMENT_SECRETS_ENCRYPTION_KEY не задана, сохраняет как есть (чтобы не ломать тестовую среду).
 */
export function encryptSecret(plainText: string): string {
  const value = String(plainText || "").trim();
  if (!value) return "";
  if (value.startsWith(ENC_PREFIX)) return value;

  const key = getEncryptionKey();
  if (!key) return value;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Расшифровывает API-ключ банка на сервере.
 * Обратно совместим со старыми незашифрованными ключами.
 */
export function decryptSecret(storedValue: string | null | undefined): string {
  const raw = String(storedValue || "").trim();
  if (!raw) return "";
  if (!raw.startsWith(ENC_PREFIX)) return raw;

  const key = getEncryptionKey();
  if (!key) return "";

  try {
    const body = raw.slice(ENC_PREFIX.length);
    const parts = body.split(":");
    if (parts.length !== 3) return "";
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const encrypted = Buffer.from(parts[2], "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
