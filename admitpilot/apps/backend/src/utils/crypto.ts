import crypto from 'crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const SEED_UUIDS: Record<string, string> = {
  'org-global-edu': '00000000-0000-4000-8000-000000000001',
  'usr-admin-1': '00000000-0000-4000-8000-000000000101',
  'usr-2': '00000000-0000-4000-8000-000000000102',
  'usr-3': '00000000-0000-4000-8000-000000000103',
  'usr-4': '00000000-0000-4000-8000-000000000104',
  'team-uk-ie': '00000000-0000-4000-8000-000000000201',
  'team-us-ca': '00000000-0000-4000-8000-000000000202',
  'team-au-nz': '00000000-0000-4000-8000-000000000203',
  'team-eu-de': '00000000-0000-4000-8000-000000000204',
  'cand-ali-khan-1': '00000000-0000-4000-8000-000000000301',
  'doc-seed-passport': '00000000-0000-4000-8000-000000000401',
  'doc-seed-transcript': '00000000-0000-4000-8000-000000000402',
  'doc-seed-ielts': '00000000-0000-4000-8000-000000000403',
  'cred-seed-email': '00000000-0000-4000-8000-000000000501',
  'cred-seed-manchester': '00000000-0000-4000-8000-000000000502',
  'cred-seed-ucas': '00000000-0000-4000-8000-000000000503',
  'app-seed-manchester': '00000000-0000-4000-8000-000000000601',
  'app-seed-tum': '00000000-0000-4000-8000-000000000602',
};

export const DEFAULT_ORG_UUID = SEED_UUIDS['org-global-edu'];
export const DEFAULT_ADMIN_UUID = SEED_UUIDS['usr-admin-1'];

/**
 * Converts any legacy string identifier into a deterministic RFC-4122 UUID,
 * or generates a random UUID when empty.
 */
export function toUuid(rawId?: string | null): string {
  if (!rawId || !rawId.trim()) {
    return crypto.randomUUID();
  }
  const trimmed = rawId.trim();
  if (SEED_UUIDS[trimmed]) {
    return SEED_UUIDS[trimmed];
  }
  if (UUID_REGEX.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  const hash = crypto.createHash('sha256').update(`admitpilot:${trimmed}`).digest();
  hash[6] = (hash[6] & 0x0f) | 0x40;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function getDerivedAesKey(): Buffer {
  const secret = process.env.JWT_SECRET || 'admitpilot-fallback-encryption-seed-32chars';
  return crypto.createHash('sha256').update(`admitpilot-vault:${secret}`).digest();
}

/**
 * Encrypts sensitive student email / portal credentials or API keys using AES-256-GCM.
 */
export function encryptSecret(plainText?: string | null): string | null {
  if (!plainText) return null;
  const key = getDerivedAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts AES-256-GCM encrypted secret strings.
 */
export function decryptSecret(payload?: string | null): string | undefined {
  if (!payload) return undefined;
  if (!payload.startsWith('v1:')) {
    return payload;
  }
  try {
    const [, ivB64, tagB64, dataB64] = payload.split(':');
    const key = getDerivedAesKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return undefined;
  }
}

export function maskSecret(secret?: string | null): string | undefined {
  if (!secret) return undefined;
  if (secret.length <= 4) return '••••••••';
  return `${'•'.repeat(Math.min(10, Math.max(6, secret.length - 2)))}${secret.slice(-2)}`;
}

/**
 * Hashes a user login password using Node crypto.scryptSync with a 16-byte random salt.
 */
export function hashPassword(plainText: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainText, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

/**
 * Constant-time verification of a user login password against a stored scrypt hash.
 */
export function verifyPassword(plainText: string, storedHash?: string | null): boolean {
  if (!storedHash || !plainText) return false;
  if (!storedHash.startsWith('scrypt:')) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  try {
    const derived = crypto.scryptSync(plainText, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
