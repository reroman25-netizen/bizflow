import crypto from "crypto";

interface LinkCodeEntry {
  userId: string;
  expiresAt: number;
}

const globalForLinkCodes = globalThis as unknown as {
  __tiyinTelegramLinkCodes?: Map<string, LinkCodeEntry>;
};

function getStore(): Map<string, LinkCodeEntry> {
  if (!globalForLinkCodes.__tiyinTelegramLinkCodes) {
    globalForLinkCodes.__tiyinTelegramLinkCodes = new Map<string, LinkCodeEntry>();
  }
  return globalForLinkCodes.__tiyinTelegramLinkCodes;
}

function getSigningSecret(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.TELEGRAM_AUTH_BOT_TOKEN ||
    "tiyin-link-secret"
  ).trim();
}

function pruneExpired(store: Map<string, LinkCodeEntry>) {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  });
}

export function createSixDigitLinkCode(userId: string, ttlMinutes = 15): string {
  const store = getStore();
  pruneExpired(store);

  // Удаляем старые коды этого же пользователя
  store.forEach((entry, key) => {
    if (entry.userId === userId) {
      store.delete(key);
    }
  });

  let code = "";
  for (let i = 0; i < 10; i++) {
    const candidate = String(crypto.randomInt(100000, 1000000));
    if (!store.has(candidate)) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    code = String(crypto.randomInt(100000, 1000000));
  }

  store.set(code, {
    userId,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000,
  });

  return code;
}

export function consumeSixDigitLinkCode(code: string): string | null {
  const clean = String(code || "").replace(/\D/g, "");
  if (clean.length !== 6) return null;

  const store = getStore();
  pruneExpired(store);

  const entry = store.get(clean);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    store.delete(clean);
    return null;
  }

  store.delete(clean);
  return entry.userId;
}

function uuidToBytes(uuid: string): Buffer | null {
  const hex = uuid.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return Buffer.from(hex, "hex");
}

function bytesToUuid(buf: Buffer): string {
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Компактный подписанный токен для Telegram startapp (ровно 46 символов [A-Za-z0-9_-])
export function createSignedStartParam(userId: string, ttlMinutes = 30): string {
  const uuidBytes = uuidToBytes(userId);
  if (!uuidBytes) {
    throw new Error("Invalid userId UUID");
  }
  const expSec = Math.floor(Date.now() / 1000) + ttlMinutes * 60;
  const expBuf = Buffer.alloc(4);
  expBuf.writeUInt32BE(expSec, 0);

  const payload = Buffer.concat([uuidBytes, expBuf]); // 20 bytes
  const payloadB64 = payload.toString("base64url"); // 27 chars

  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(payloadB64)
    .digest()
    .subarray(0, 12)
    .toString("base64url"); // 16 chars

  return `L_${payloadB64}_${sig}`;
}

export function verifySignedStartParam(startParam: string): string | null {
  try {
    const raw = String(startParam || "").trim();
    if (!raw.startsWith("L_")) return null;
    const parts = raw.split("_");
    if (parts.length !== 3) return null;

    const payloadB64 = parts[1];
    const sig = parts[2];

    const expectedSig = crypto
      .createHmac("sha256", getSigningSecret())
      .update(payloadB64)
      .digest()
      .subarray(0, 12)
      .toString("base64url");

    const bufA = Buffer.from(sig);
    const bufB = Buffer.from(expectedSig);
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }

    const payload = Buffer.from(payloadB64, "base64url");
    if (payload.length !== 20) return null;

    const expSec = payload.readUInt32BE(16);
    if (Math.floor(Date.now() / 1000) > expSec) {
      return null;
    }

    return bytesToUuid(payload.subarray(0, 16));
  } catch {
    return null;
  }
}
