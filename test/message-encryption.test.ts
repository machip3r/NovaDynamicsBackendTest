import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createMessageEncryptionService } from '../src/services/message-encryption.service.ts';

test('encrypts and decrypts messages through a JSON round trip', () => {
  const service = createMessageEncryptionService(randomBytes(32));

  for (const message of ['Inquiry about café ☕\nSecond line.', '', '\uD800']) {
    const encrypted = service.encrypt(message);
    assert.equal(Buffer.from(encrypted.iv, 'base64').length, 12);
    assert.equal(Buffer.from(encrypted.authTag, 'base64').length, 16);
    assert.equal(service.decrypt(JSON.parse(JSON.stringify(encrypted))), message);
  }
});

test('uses a fresh IV and produces different ciphertext for the same message', () => {
  const service = createMessageEncryptionService(randomBytes(32));
  const first = service.encrypt('Same message.');
  const second = service.encrypt('Same message.');

  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
});

test('rejects a record encrypted with a different key', () => {
  const key = randomBytes(32);
  const wrongKey = Buffer.from(key);
  wrongKey[0] ^= 1;
  const record = createMessageEncryptionService(key).encrypt('Confidential inquiry.');

  assert.throws(
    () => createMessageEncryptionService(wrongKey).decrypt(record),
    /authentication failed/,
  );
});

test('rejects changes to the ciphertext, IV, or authentication tag', () => {
  const service = createMessageEncryptionService(randomBytes(32));
  const record = service.encrypt('Confidential inquiry.');

  for (const field of ['ciphertext', 'iv', 'authTag'] as const) {
    const changed = Buffer.from(record[field], 'base64');
    changed[0] ^= 1;
    assert.throws(
      () => service.decrypt({ ...record, [field]: changed.toString('base64') }),
      /authentication failed/,
    );
  }
});

test('rejects malformed records and noncanonical Base64', () => {
  const service = createMessageEncryptionService(randomBytes(32));
  const record = service.encrypt('Confidential inquiry.');

  for (const invalid of [null, { iv: record.iv }, { ...record, authTag: '' }, {
    ...record,
    ciphertext: `${record.ciphertext}\n`,
  }]) {
    assert.throws(() => service.decrypt(invalid), /Invalid encrypted message/);
  }
});
