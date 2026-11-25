export function readConfig(env: NodeJS.ProcessEnv) {
  const port = Number(env.PORT ?? '3000');

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  const encodedKey = env.MESSAGE_ENCRYPTION_KEY;
  const invalidKey = 'MESSAGE_ENCRYPTION_KEY must contain 32 bytes encoded as padded Base64.';

  if (encodedKey?.length !== 44) {
    throw new Error(invalidKey);
  }

  const encryptionKey = Buffer.from(encodedKey, 'base64');
  if (encryptionKey.length !== 32 || encryptionKey.toString('base64') !== encodedKey) {
    throw new Error(invalidKey);
  }

  const aiCircuitResetTimeoutMs = Number(env.AI_CIRCUIT_RESET_TIMEOUT_MS ?? '30000');
  if (!Number.isSafeInteger(aiCircuitResetTimeoutMs) || aiCircuitResetTimeoutMs < 1) {
    throw new Error('AI_CIRCUIT_RESET_TIMEOUT_MS must be a positive integer in milliseconds.');
  }

  const mockAiFailureCountValue = env.MOCK_AI_FAILURE_COUNT ?? '0';
  const mockAiFailureCount = Number(mockAiFailureCountValue);
  if (mockAiFailureCountValue.trim() === '' || !Number.isSafeInteger(mockAiFailureCount) || mockAiFailureCount < 0) {
    throw new Error('MOCK_AI_FAILURE_COUNT must be a nonnegative integer.');
  }

  return { port, encryptionKey, aiCircuitResetTimeoutMs, mockAiFailureCount };
}
