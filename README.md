# Nova Dynamics Backend

Express API with TypeScript and Zod.

## Docker Compose

Start Docker Desktop or Docker Engine with the Compose plugin. For a new audit database, generate the encryption key into a local `.env` file. If you already have a key for existing records, set `MESSAGE_ENCRYPTION_KEY` to that key in `.env` or your shell.

```sh
(
  umask 077
  set -C
  key=$(docker run --rm node:24-bookworm-slim node -p 'require("node:crypto").randomBytes(32).toString("base64")') &&
    printf 'MESSAGE_ENCRYPTION_KEY=%s\n' "$key" > .env
)
docker compose build
docker compose up -d
```

The setup command preserves an existing `.env`. Compose passes the key when the container starts, and `.env` is excluded from the build. Keep the same key for as long as you need to decrypt records in the volume.

| Variable | Default | Purpose |
| --- | --- | --- |
| `MESSAGE_ENCRYPTION_KEY` | Required | Padded Base64 value that decodes to 32 bytes |
| `HOST_PORT` | `3000` | Published port on the host |
| `PORT` | `3000` | Port the API listens on in the container |
| `AI_CIRCUIT_RESET_TIMEOUT_MS` | `30000` | Circuit breaker cooldown in milliseconds |
| `MOCK_AI_FAILURE_COUNT` | `0` | Number of initial mock AI calls to fail |

```sh
curl --fail-with-body http://localhost:3000/secure-inquiry \
  -H 'Content-Type: application/json' \
  -d '{"userId":"user-123","message":"I have a question about my account."}'
```

The `audit-data` volume stores `/app/data/audit-log.json`. `docker compose down` removes the container and preserves the volume for the next `docker compose up -d`. `docker compose down --volumes` deletes the audit volume. On shutdown, the server stops accepting connections and lets active requests finish within Compose's 30-second grace period.

## Local development

Local development requires Node.js 22.18 or later and pnpm 12.11.2.

```sh
pnpm install --frozen-lockfile
export MESSAGE_ENCRYPTION_KEY="$(node -p 'require("node:crypto").randomBytes(32).toString("base64")')"
pnpm dev
```

The example generates a key for local development. For records you need to keep, load a stable `MESSAGE_ENCRYPTION_KEY` from your secret store. Startup requires a canonical Base64 value that decodes to 32 bytes. Keep the key available for as long as records encrypted with it need to be read.

The server listens on port `3000` by default. Set `PORT` to override it. Use `pnpm typecheck` to check types, `pnpm build` to compile, and `pnpm start` to run the compiled app.

## POST /secure-inquiry

Send uncompressed `application/json` with a JSON object containing `userId` and `message` as strings. Compressed request bodies return HTTP `415`.

```json
{
  "userId": "user-123",
  "message": "I have a question about my account."
}
```

API responses use the JSON shape `{ data, success, error }`. `data` can be an object or an array of objects. `error` is `null` on success or a message string on failure.

- A successful inquiry returns HTTP `200` with `{"data":{},"success":true,"error":null}`.
- Invalid input returns HTTP `400`. Field validation details are available in `data.issues`.
- An attempted AI call that fails returns HTTP `502` with `"AI request failed."` in `error`.
- While the breaker blocks calls, the endpoint skips AI and returns HTTP `503` with `"Service Busy"` in `error` after the audit write.
- If the audit record cannot be saved, the endpoint returns HTTP `500` with a generic error.

The application factory in `src/app.ts` wires the router to an injectable controller. `src/server.ts` creates one AI service, one shared circuit breaker, and one audit repository before starting the listener. Routes compose parsing and validation middleware with schemas from `src/schemas`. Business logic lives in `src/services` and file persistence lives in `src/repositories`.

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

## Audit log

Validated inquiries are recorded in `data/audit-log.json` by default. Set `AUDIT_LOG_PATH` to use a different file. Each record contains a UUID, the user ID, the request start time in UTC, the encrypted original, the sanitized text, the outcome, and elapsed processing time in milliseconds measured up to the audit write. The plaintext audit field stores the sanitizer's output, which is identical to the input when no supported pattern matches.

The API waits for the audit write before returning the outcome, including when AI fails or the circuit blocks the call. The repository queues concurrent writes and replaces the audit file with a fully written temporary file. Use one backend process per audit file. The queue is local to that process, and each write reads and rewrites the full array.
