import type { EncryptedMessage } from '../services/message-encryption.service.ts';

export type InquiryResult = 'success' | 'failure' | 'service_busy';

export type AuditRecord = {
  requestId: string;
  userId: string;
  requestedAt: string;
  encryptedMessage: EncryptedMessage;
  sanitizedMessage: string;
  result: InquiryResult;
  processingTimeMs: number;
};

export interface AuditRepository {
  append(record: AuditRecord): Promise<void>;
}
