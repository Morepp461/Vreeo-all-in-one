import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export function createOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

export function hashOpaqueToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token, 'utf8').digest('hex');
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
