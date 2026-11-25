import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { readConfig } from '../src/config/env.ts';

test('loads the message encryption key from the environment', () => {
  const key = randomBytes(32);
  const config = readConfig({ PORT: '4000', MESSAGE_ENCRYPTION_KEY: key.toString('base64') });

  assert.deepEqual(config, { port: 4000, encryptionKey: key });
});

test('rejects missing, malformed, and incorrectly sized encryption keys', () => {
  const valid = randomBytes(32).toString('base64');

  for (const invalid of [undefined, '', valid.slice(0, -1), `!${valid.slice(1)}`, randomBytes(31).toString('base64')]) {
    assert.throws(
      () => readConfig({ MESSAGE_ENCRYPTION_KEY: invalid }),
      { message: 'MESSAGE_ENCRYPTION_KEY must contain 32 bytes encoded as padded Base64.' },
    );
  }
});
