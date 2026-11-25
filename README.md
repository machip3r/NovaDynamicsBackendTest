# Nova Dynamics Backend

Express API scaffold with TypeScript and Zod. It requires Node.js 22.18 or later and pnpm 12.11.2.

```sh
pnpm install --frozen-lockfile
export MESSAGE_ENCRYPTION_KEY="$(node -p 'require("node:crypto").randomBytes(32).toString("base64")')"
pnpm dev
```

The example generates a key for local development. For records you need to keep, load a stable `MESSAGE_ENCRYPTION_KEY` from your secret store. Startup requires a canonical Base64 value that decodes to 32 bytes. Keep the key available for as long as records encrypted with it need to be read.

The server listens on port `3000` by default. Set `PORT` to override it. Use `pnpm typecheck` to check types, `pnpm build` to compile, and `pnpm start` to run the compiled app.

## POST /secure-inquiry

Send `Content-Type: application/json` with a JSON object containing `userId` and `message` as strings.

```json
{
  "userId": "user-123",
  "message": "I have a question about my account."
}
```

A successful request returns HTTP `200` with an empty body. Invalid input returns HTTP `400` with the affected fields when available. An attempted AI call that fails returns HTTP `502` with `{"error":"AI request failed."}`. While the breaker blocks calls, the endpoint immediately returns HTTP `503` with `{"error":"Service Busy"}`.

The application factory in `src/app.ts` wires the router to an injectable controller. `src/server.ts` creates one AI service and one shared circuit breaker before starting the listener. Routes compose parsing and validation middleware with schemas from `src/schemas`. Business logic lives in `src/services`, and `src/repositories` is reserved for persistence.

## Message sanitizer

`sanitizeMessage(message)` in `src/services/message-sanitizer.service.ts` returns a redacted string for the AI call and leaves the input available for later use. Run `pnpm test` to exercise the service.

The sanitizer covers conventional ASCII email addresses, 12–19 digit card candidates with optional spaces or single hyphens between digit groups, and U.S. SSNs written as `XXX-XX-XXXX` or nine contiguous digits. Luhn checks are omitted so mistyped card numbers are still redacted.

Order numbers and other identifiers with the same shapes can also be redacted. Adjacent numeric values can be ambiguous, so the sanitizer favors the split that covers the most digits and uses standard formats to break ties. Internationalized or quoted emails, shorter card numbers, and obfuscated values using unsupported separators can be missed.

## Message encryption

`createMessageEncryptionService(encryptionKey)` accepts the decoded key from `readConfig`. Pass the original message to `encrypt` and store its returned `ciphertext`, `iv`, and `authTag` Base64 strings together in the JSON record. Pass that record to `decrypt` to recover the original message. AES-256-GCM uses a new random 12-byte IV on every encryption and a 16-byte authentication tag. The plaintext is encoded as UTF-16LE to preserve JavaScript strings exactly.

## Mock AI and circuit breaker

The mock AI takes two seconds per attempt. Set `MOCK_AI_FAILURE_COUNT` to the number of initial attempts that should fail, in call order. It defaults to `0`. Set `AI_CIRCUIT_RESET_TIMEOUT_MS` to change the cooldown from its default of `30000` milliseconds. For example, start the server with `MOCK_AI_FAILURE_COUNT=3 AI_CIRCUIT_RESET_TIMEOUT_MS=5000 pnpm dev` to see three failures followed by an open circuit and a successful recovery probe.

While closed, the breaker counts consecutive failures in completion order and resets the count on success. After three failures it opens. Once the cooldown elapses, the next request becomes the single half-open probe. It closes the circuit on success or starts a new cooldown on failure. Additional requests are blocked until the probe finishes, and completions from requests admitted in an earlier state cannot update the current state.

Each backend process has its own breaker and mock failure count, both reset on restart. Behind a load balancer, one instance can return `503` while another still calls AI. A global circuit would require shared state and an atomic way to grant one recovery probe across instances.
