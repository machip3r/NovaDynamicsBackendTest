import { createApp } from './app.ts';
import { readConfig } from './config/env.ts';
import { createSecureInquiryController } from './controllers/secure-inquiry.controller.ts';
import { createJsonAuditRepository } from './repositories/json-audit.repository.ts';
import { createCircuitBreaker } from './services/circuit-breaker.service.ts';
import { createMessageEncryptionService } from './services/message-encryption.service.ts';
import { createMockAiService } from './services/mock-ai.service.ts';
import { createSecureInquiryService } from './services/secure-inquiry.service.ts';

const { port, encryptionKey, aiCircuitResetTimeoutMs, mockAiFailureCount, auditLogPath } = readConfig(process.env);
const ai = createMockAiService(mockAiFailureCount);
const breaker = createCircuitBreaker({ resetTimeoutMs: aiCircuitResetTimeoutMs });
const { encrypt } = createMessageEncryptionService(encryptionKey);
const processInquiry = createSecureInquiryService({
  auditRepository: createJsonAuditRepository(auditLogPath),
  encrypt,
  generateAnswer: (sanitizedMessage) => breaker.execute(() => ai.generateAnswer(sanitizedMessage)),
});
const handleInquiry = createSecureInquiryController(processInquiry);

createApp(handleInquiry).listen(port, (error) => {
  if (error) {
    console.error(`Could not start the API on port ${port}.`, error);
    process.exitCode = 1;
    return;
  }

  console.log(`API listening on port ${port}`);
});
