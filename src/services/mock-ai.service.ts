export function createMockAiService(failureCount: number) {
  let remainingFailures = failureCount;

  async function generateAnswer(_message: string): Promise<string> {
    const shouldFail = remainingFailures > 0;
    if (shouldFail) remainingFailures--;

    await new Promise<void>((resolve) => setTimeout(resolve, 2_000));

    if (shouldFail) {
      throw new Error('Simulated AI request failure.');
    }

    return 'Generated Answer';
  }

  return { generateAnswer };
}
