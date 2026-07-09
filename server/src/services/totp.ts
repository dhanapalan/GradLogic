import crypto from "crypto";
import { env } from "../config/env.js";

/**
 * Dependency-free TOTP (RFC 6238) implementation using Node's crypto.
 *
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator, 1Password,
 * etc. Secrets are RFC 4648 base32. The shared secret is encrypted at rest with
 * AES-256-GCM (key derived from JWT_SECRET) — see encryptSecret/decryptSecret.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

// ── Base32 ────────────────────────────────────────────────────────────────────

/** Generate a random base32 secret (default 20 bytes → 160 bits, per RFC 4226). */
export function generateBase32Secret(byteLength = 20): string {
  const buf = crypto.randomBytes(byteLength);
  let out = "";
  let value = 0;
  let bits = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  const bytes: number[] = [];
  let value = 0;
  let bits = 0;
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ── HOTP / TOTP ────────────────────────────────────────────────────────────────

function hotp(secret: string, counter: number, digits = DIGITS): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // 64-bit big-endian counter (split to stay within 32-bit writes).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

/** Current TOTP code for a secret (mainly useful for tests/debugging). */
export function generateTOTP(secret: string, at: number = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  return hotp(secret, counter);
}

/**
 * Verify a user-supplied TOTP code, allowing ±`window` steps of clock drift
 * (default ±1 → tolerates ~30s skew). Uses a timing-safe comparison.
 */
export function verifyTOTP(secret: string, token: string, window = 1): boolean {
  if (!token || !/^\d{6}$/.test(token.trim())) return false;
  const normalized = token.trim();
  const counter = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let i = -window; i <= window; i++) {
    const candidate = hotp(secret, counter + i);
    if (
      candidate.length === normalized.length &&
      crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(normalized))
    ) {
      return true;
    }
  }
  return false;
}

/** Build the otpauth:// provisioning URI used by authenticator apps / QR codes. */
export function buildOtpauthUrl(secret: string, accountName: string, issuer = "GradLogic"): string {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ── Secret encryption at rest (AES-256-GCM) ─────────────────────────────────────

const AES_KEY = crypto.scryptSync(env.JWT_SECRET, "talentsecure-2fa-secret-salt", 32);

/** Encrypt a base32 secret for storage. Format: iv:tag:ciphertext (hex). */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Decrypt a stored secret. Throws if tampered/invalid. */
export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
