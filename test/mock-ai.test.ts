import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockAiService } from '../src/services/mock-ai.service.ts';

test('delays all results by two seconds and fails the configured number of calls', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ai = createMockAiService(2);
  const first = assert.rejects(ai.generateAnswer('First'), /Simulated AI request failure/);
  const second = assert.rejects(ai.generateAnswer('Second'), /Simulated AI request failure/);
  let settled = false;
  const third = ai.generateAnswer('Third').then((answer) => {
    settled = true;
    return answer;
  });

  t.mock.timers.tick(1_999);
  await Promise.resolve();
  assert.equal(settled, false);

  t.mock.timers.tick(1);
  await Promise.all([first, second]);
  assert.equal(await third, 'Generated Answer');
});
