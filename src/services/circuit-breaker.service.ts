type CircuitState =
  | { status: 'CLOSED'; consecutiveFailures: number }
  | { status: 'OPEN'; openedAt: number }
  | { status: 'HALF_OPEN' };

type CircuitBreakerOptions = {
  resetTimeoutMs: number;
  now?: () => number;
};

export class CircuitOpenError extends Error {
  constructor() {
    super('Circuit is open.');
    this.name = 'CircuitOpenError';
  }
}

export function createCircuitBreaker({
  resetTimeoutMs,
  now = () => performance.now(),
}: CircuitBreakerOptions) {
  let state: CircuitState = { status: 'CLOSED', consecutiveFailures: 0 };

  async function execute<T>(operation: () => Promise<T> | T): Promise<T> {
    if (state.status === 'OPEN' && now() - state.openedAt >= resetTimeoutMs) {
      // Reserve the recovery probe before invoking or awaiting the operation.
      state = { status: 'HALF_OPEN' };
    } else if (state.status !== 'CLOSED') {
      throw new CircuitOpenError();
    }

    // Each transition replaces the state object, invalidating older completions.
    const admittedState = state;

    try {
      const result = await operation();

      if (state === admittedState) {
        if (admittedState.status === 'HALF_OPEN') {
          state = { status: 'CLOSED', consecutiveFailures: 0 };
        } else {
          admittedState.consecutiveFailures = 0;
        }
      }

      return result;
    } catch (error) {
      if (state === admittedState) {
        if (admittedState.status === 'CLOSED') {
          admittedState.consecutiveFailures++;
        }

        if (admittedState.status === 'HALF_OPEN' || admittedState.consecutiveFailures >= 3) {
          state = { status: 'OPEN', openedAt: now() };
        }
      }

      throw error;
    }
  }

  return { execute, getState: () => state.status };
}
