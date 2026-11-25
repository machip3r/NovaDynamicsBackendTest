import { createCipheriv, createDecipheriv, createSecretKey, randomBytes } from 'node:crypto';

const algorithm = 'aes-256-gcm';
const ivLength = 12;
const authTagLength = 16;

export type EncryptedMessage = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

function decodeBase64(value: unknown, expectedLength?: number): Buffer {
  if (typeof value !== 'string') {
    throw new Error('Invalid encrypted message.');
  }

  const decoded = Buffer.from(value, 'base64');
  if (
    (expectedLength !== undefined && decoded.length !== expectedLength) ||
    decoded.toString('base64') !== value
  ) {
    throw new Error('Invalid encrypted message.');
  }

  return decoded;
}

export function createMessageEncryptionService(key: Buffer) {
  if (key.length !== 32) {
    throw new Error('The message encryption key must be 32 bytes.');
  }

  const secretKey = createSecretKey(key);

  function encrypt(message: string): EncryptedMessage {
    const iv = randomBytes(ivLength);
    const cipher = createCipheriv(algorithm, secretKey, iv, { authTagLength });
    // Preserve every JavaScript string code unit for the audit record.
    const ciphertext = Buffer.concat([cipher.update(message, 'utf16le'), cipher.final()]);

    return {
      ciphertext: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
    };
  }

  function decrypt(record: unknown): string {
    if (
      typeof record !== 'object' || record === null ||
      !('ciphertext' in record && 'iv' in record && 'authTag' in record)
    ) {
      throw new Error('Invalid encrypted message.');
    }

    const ciphertext = decodeBase64(record.ciphertext);
    const iv = decodeBase64(record.iv, ivLength);
    const authTag = decodeBase64(record.authTag, authTagLength);
    const decipher = createDecipheriv(algorithm, secretKey, iv, { authTagLength });
    decipher.setAuthTag(authTag);

    try {
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf16le');
    } catch {
      throw new Error('Encrypted message authentication failed.');
    }
  }

  return { encrypt, decrypt };
}
