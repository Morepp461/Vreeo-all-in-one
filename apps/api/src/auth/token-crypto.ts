import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const version = 'v1';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptOAuthToken(token: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [version, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptOAuthToken(payload: string, secret: string): string {
  const [payloadVersion, ivPart, tagPart, ciphertextPart, ...extra] = payload.split('.');
  if (payloadVersion !== version || !ivPart || !tagPart || !ciphertextPart || extra.length > 0) {
    throw new Error('Stored OAuth token has an unsupported format.');
  }

  const iv = Buffer.from(ivPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  const ciphertext = Buffer.from(ciphertextPart, 'base64url');
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Stored OAuth token is malformed.');
  }

  const decipher = createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
