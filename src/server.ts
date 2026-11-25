import { createApp } from './app.ts';
import { readConfig } from './config/env.ts';
import { createSecureInquiryController } from './controllers/secure-inquiry.controller.ts';
import { createCircuitBreaker } from './services/circuit-breaker.service.ts';
import { sanitizeMessage } from './services/message-sanitizer.service.ts';
import { createMockAiService } from './services/mock-ai.service.ts';

const { port, aiCircuitResetTimeoutMs, mockAiFailureCount } = readConfig(process.env);
const ai = createMockAiService(mockAiFailureCount);
const breaker = createCircuitBreaker({ resetTimeoutMs: aiCircuitResetTimeoutMs });
const handleInquiry = createSecureInquiryController((message) =>
  breaker.execute(() => ai.generateAnswer(sanitizeMessage(message))),
);

createApp(handleInquiry).listen(port, (error) => {
  if (error) {
    console.error(`Could not start the API on port ${port}.`, error);
    process.exitCode = 1;
    return;
  }

  console.log(`API listening on port ${port}`);
});
