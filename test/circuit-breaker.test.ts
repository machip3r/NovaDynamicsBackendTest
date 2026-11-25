import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CircuitOpenError, createCircuitBreaker } from '../src/services/circuit-breaker.service.ts';
import { createMockAiService } from '../src/services/mock-ai.service.ts';

const resetTimeoutMs = 30_000;

function fail(): never {
  throw new Error('Upstream failure');
}

async function openCircuit(breaker: ReturnType<typeof createCircuitBreaker>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await assert.rejects(breaker.execute(fail), /Upstream failure/);
  }
  assert.equal(breaker.getState(), 'OPEN');
}

test('starts closed and opens only after three consecutive failures', async () => {
  const breaker = createCircuitBreaker({ resetTimeoutMs });
  assert.equal(breaker.getState(), 'CLOSED');

  await assert.rejects(breaker.execute(fail), /Upstream failure/);
  await assert.rejects(breaker.execute(fail), /Upstream failure/);
  assert.equal(await breaker.execute(() => Promise.resolve('success')), 'success');
  await assert.rejects(breaker.execute(fail), /Upstream failure/);
  await assert.rejects(breaker.execute(fail), /Upstream failure/);
  assert.equal(breaker.getState(), 'CLOSED');

  await assert.rejects(breaker.execute(fail), /Upstream failure/);
  assert.equal(breaker.getState(), 'OPEN');
});

test('skips AI calls while open and admits exactly one concurrent half-open probe', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const breaker = createCircuitBreaker({ resetTimeoutMs, now: () => Date.now() });
  const ai = createMockAiService(3);
  const callAi = t.mock.fn(() => ai.generateAnswer('Inquiry'));

  const failedRequests = Array.from({ length: 3 }, () =>
    assert.rejects(breaker.execute(callAi), /Simulated AI request failure/),
  );
  t.mock.timers.tick(2_000);
  await Promise.all(failedRequests);
  assert.equal(breaker.getState(), 'OPEN');

  await assert.rejects(breaker.execute(callAi), CircuitOpenError);
  t.mock.timers.tick(resetTimeoutMs - 1);
  await assert.rejects(breaker.execute(callAi), CircuitOpenError);
  assert.equal(callAi.mock.callCount(), 3);

  t.mock.timers.tick(1);
  const probe = breaker.execute(callAi);
  assert.equal(breaker.getState(), 'HALF_OPEN');
  await Promise.all(Array.from({ length: 3 }, () => assert.rejects(breaker.execute(callAi), CircuitOpenError)));
  assert.equal(callAi.mock.callCount(), 4);

  t.mock.timers.tick(2_000);
  assert.equal(await probe, 'Generated Answer');
  assert.equal(breaker.getState(), 'CLOSED');

  const nextRequest = breaker.execute(callAi);
  t.mock.timers.tick(2_000);
  assert.equal(await nextRequest, 'Generated Answer');
  assert.equal(callAi.mock.callCount(), 5);
});

test('a failed half-open probe opens the circuit for a new full cooldown', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const breaker = createCircuitBreaker({ resetTimeoutMs: 500, now: () => Date.now() });
  await openCircuit(breaker);

  t.mock.timers.tick(500);
  const probe = breaker.execute(() => new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Probe failed')), 2_000);
  }));
  assert.equal(breaker.getState(), 'HALF_OPEN');
  const rejection = assert.rejects(probe, /Probe failed/);
  t.mock.timers.tick(2_000);
  await rejection;
  assert.equal(breaker.getState(), 'OPEN');

  const recover = t.mock.fn(() => 'recovered');
  t.mock.timers.tick(499);
  await assert.rejects(breaker.execute(recover), CircuitOpenError);
  assert.equal(recover.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.equal(await breaker.execute(recover), 'recovered');
  assert.equal(breaker.getState(), 'CLOSED');
});

test('late successes and failures cannot change a newer circuit state', async (t) => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 0 });
  const breaker = createCircuitBreaker({ resetTimeoutMs, now: () => Date.now() });
  const lateFailure = assert.rejects(breaker.execute(() => new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Late failure')), 35_000);
  })), /Late failure/);
  const lateSuccess = breaker.execute(() => new Promise((resolve) => {
    setTimeout(() => resolve('late success'), 40_000);
  }));
  await openCircuit(breaker);

  t.mock.timers.tick(resetTimeoutMs);
  assert.equal(await breaker.execute(() => 'recovered'), 'recovered');
  await assert.rejects(breaker.execute(fail), /Upstream failure/);
  await assert.rejects(breaker.execute(fail), /Upstream failure/);

  t.mock.timers.tick(5_000);
  await lateFailure;
  assert.equal(breaker.getState(), 'CLOSED');
  t.mock.timers.tick(5_000);
  assert.equal(await lateSuccess, 'late success');

  await assert.rejects(breaker.execute(fail), /Upstream failure/);
  assert.equal(breaker.getState(), 'OPEN');
});
