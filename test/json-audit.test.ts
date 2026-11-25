import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { AuditRecord } from '../src/repositories/audit.repository.ts';
import { createJsonAuditRepository } from '../src/repositories/json-audit.repository.ts';

function record(requestId: string): AuditRecord {
  return {
    requestId,
    userId: 'user-1',
    requestedAt: new Date().toISOString(),
    encryptedMessage: { ciphertext: '', iv: '', authTag: '' },
    sanitizedMessage: '<REDACTED: EMAIL>',
    result: 'success',
    processingTimeMs: 5,
  };
}

test('preserves existing records and every concurrent append', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'json-audit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'nested', 'audit.json');
  const repository = createJsonAuditRepository(path);
  const initialRecord = record('existing');
  await repository.append(initialRecord);

  const newRecords = Array.from({ length: 30 }, (_, index) => record(`request-${index}`));
  await Promise.all(newRecords.map((entry) => repository.append(entry)));

  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.deepEqual(saved, [initialRecord, ...newRecords]);
});

test('preserves invalid existing contents and accepts further writes after repair', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'json-audit-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, 'audit.json');
  const repository = createJsonAuditRepository(path);

  await writeFile(path, '[{"incomplete":');
  await assert.rejects(repository.append(record('unsaved')), SyntaxError);
  assert.equal(await readFile(path, 'utf8'), '[{"incomplete":');

  await writeFile(path, '{"unexpected":true}');
  await assert.rejects(repository.append(record('unsaved')), /must contain a JSON array/);
  assert.equal(await readFile(path, 'utf8'), '{"unexpected":true}');

  await writeFile(path, '[]');
  const recoveredRecord = record('saved');
  await repository.append(recoveredRecord);
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), [recoveredRecord]);
});
