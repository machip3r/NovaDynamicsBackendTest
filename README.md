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

A valid request returns HTTP `200` with `{"received":true}`. Invalid input returns HTTP `400` with the affected fields when available. This scaffold only validates and acknowledges the request.

The application factory in `src/app.ts` wires the router to an injectable controller, and `src/server.ts` starts the listener using `src/config`. Routes compose parsing and validation middleware with schemas from `src/schemas`. Business logic lives in `src/services`, and `src/repositories` is reserved for persistence.

## Message sanitizer

`sanitizeMessage(message)` in `src/services/message-sanitizer.service.ts` returns a redacted string and leaves the input available for later use. Run `pnpm test` to exercise the service. The service is independent of the HTTP endpoint and any AI client.

The sanitizer covers conventional ASCII email addresses, 12–19 digit card candidates with optional spaces or single hyphens between digit groups, and U.S. SSNs written as `XXX-XX-XXXX` or nine contiguous digits. Luhn checks are omitted so mistyped card numbers are still redacted.

Order numbers and other identifiers with the same shapes can also be redacted. Adjacent numeric values can be ambiguous, so the sanitizer favors the split that covers the most digits and uses standard formats to break ties. Internationalized or quoted emails, shorter card numbers, and obfuscated values using unsupported separators can be missed.

## Message encryption

`createMessageEncryptionService(encryptionKey)` accepts the decoded key from `readConfig`. Pass the original message to `encrypt` and store its returned `ciphertext`, `iv`, and `authTag` Base64 strings together in the JSON record. Pass that record to `decrypt` to recover the original message. AES-256-GCM uses a new random 12-byte IV on every encryption and a 16-byte authentication tag. The plaintext is encoded as UTF-16LE to preserve JavaScript strings exactly.
