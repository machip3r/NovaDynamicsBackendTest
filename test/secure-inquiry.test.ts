import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AuditRecord } from '../src/repositories/audit.repository.ts';
import { createJsonAuditRepository } from '../src/repositories/json-audit.repository.ts';
import { createCircuitBreaker } from '../src/services/circuit-breaker.service.ts';
import { createMessageEncryptionService } from '../src/services/message-encryption.service.ts';
import { createSecureInquiryService } from '../src/services/secure-inquiry.service.ts';

test('sends only sanitized text and audits success, upstream failure, and an open circuit', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'inquiry-audit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'audit.json');
  const { encrypt, decrypt } = createMessageEncryptionService(randomBytes(32));
  const breaker = createCircuitBreaker({ resetTimeoutMs: 30_000, now: () => 0 });
  let failAi = false;
  const callAi = t.mock.fn(async (_sanitizedMessage: string) => {
    if (failAi) throw new Error('Mock AI failure');
    return 'Generated Answer';
  });
  const processInquiry = createSecureInquiryService({
    auditRepository: createJsonAuditRepository(path),
    encrypt,
    generateAnswer: (message) => breaker.execute(() => callAi(message)),
  });
  const message = 'Email test@example.com... Card 4111-1111-1111-1111, SSN 123-45-6789.';
  const sanitizedMessage = 'Email <REDACTED: EMAIL>... Card <REDACTED: CREDIT_CARD>, SSN <REDACTED: SSN>.';
  const inquiry = { userId: 'user-1', message };

  assert.equal(await processInquiry(inquiry), 'success');
  failAi = true;
  const failures = await Promise.all(Array.from({ length: 3 }, () => processInquiry(inquiry)));
  assert.deepEqual(failures, ['failure', 'failure', 'failure']);
  assert.equal(await processInquiry(inquiry), 'service_busy');
  assert.deepEqual(callAi.mock.calls.map(({ arguments: args }) => args), Array(4).fill([sanitizedMessage]));

  const file = await readFile(path, 'utf8');
  for (const secret of [message, 'test@example.com', '4111-1111-1111-1111', '123-45-6789']) {
    assert.equal(file.includes(secret), false);
  }

  const records: AuditRecord[] = JSON.parse(file);
  assert.deepEqual(records.map(({ result }) => result), ['success', 'failure', 'failure', 'failure', 'service_busy']);
  assert.equal(new Set(records.map(({ requestId }) => requestId)).size, 5);
  for (const record of records) {
    assert.equal(record.userId, inquiry.userId);
    assert.equal(record.sanitizedMessage, sanitizedMessage);
    assert.equal(decrypt(record.encryptedMessage), message);
    assert.equal(new Date(record.requestedAt).toISOString(), record.requestedAt);
    assert.ok(Number.isFinite(record.processingTimeMs) && record.processingTimeMs >= 0);
  }
});

test('rejects the inquiry when saving fails after the AI succeeds', async () => {
  const saveError = new Error('Cannot save audit record');
  const { encrypt } = createMessageEncryptionService(randomBytes(32));
  const processInquiry = createSecureInquiryService({
    auditRepository: { append: async () => { throw saveError; } },
    encrypt,
    generateAnswer: async () => 'Generated Answer',
  });

  await assert.rejects(processInquiry({ userId: 'user-1', message: 'Inquiry' }), saveError);
});
