import { randomUUID } from 'node:crypto';
import type { AuditRepository, InquiryResult } from '../repositories/audit.repository.ts';
import type { SecureInquiry } from '../schemas/secure-inquiry.schema.ts';
import { CircuitOpenError } from './circuit-breaker.service.ts';
import type { EncryptedMessage } from './message-encryption.service.ts';
import { sanitizeMessage } from './message-sanitizer.service.ts';

type SecureInquiryDependencies = {
  auditRepository: AuditRepository;
  encrypt: (message: string) => EncryptedMessage;
  generateAnswer: (sanitizedMessage: string) => Promise<string>;
};

export function createSecureInquiryService({ auditRepository, encrypt, generateAnswer }: SecureInquiryDependencies) {
  return async function processInquiry({ userId, message }: SecureInquiry): Promise<InquiryResult> {
    const startedAt = performance.now();
    const requestedAt = new Date().toISOString();
    const requestId = randomUUID();
    const encryptedMessage = encrypt(message);
    const sanitizedMessage = sanitizeMessage(message);
    let result: InquiryResult = 'success';

    try {
      await generateAnswer(sanitizedMessage);
    } catch (error) {
      result = error instanceof CircuitOpenError ? 'service_busy' : 'failure';
    }

    await auditRepository.append({
      requestId,
      userId,
      requestedAt,
      encryptedMessage,
      sanitizedMessage,
      result,
      processingTimeMs: performance.now() - startedAt,
    });

    return result;
  };
}
