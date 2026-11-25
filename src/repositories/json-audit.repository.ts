import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { AuditRecord, AuditRepository } from './audit.repository.ts';

async function readRecords(filePath: string): Promise<unknown[]> {
  let contents: string;
  try {
    contents = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }

  const records: unknown = JSON.parse(contents);
  if (!Array.isArray(records)) {
    throw new Error('The audit file must contain a JSON array.');
  }

  return records;
}

export function createJsonAuditRepository(path: string): AuditRepository {
  const filePath = resolve(path);
  const directory = dirname(filePath);
  let writeQueue = Promise.resolve();

  async function appendRecord(record: AuditRecord): Promise<void> {
    const records = await readRecords(filePath);
    records.push(record);

    await mkdir(directory, { recursive: true, mode: 0o700 });
    const tempDirectory = await mkdtemp(join(directory, '.audit-'));
    const tempFile = join(tempDirectory, 'records.json');

    try {
      await writeFile(tempFile, JSON.stringify(records), { encoding: 'utf8', mode: 0o600, flush: true });
      await rename(tempFile, filePath);
    } finally {
      await rm(tempDirectory, { recursive: true, force: true }).catch(() => {});
    }
  }

  return {
    append(record) {
      // Serialize the entire read-modify-replace operation, including after a failed write.
      const write = writeQueue.then(() => appendRecord(record));
      writeQueue = write.catch(() => {});
      return write;
    },
  };
}
