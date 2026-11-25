# Nova Dynamics Backend

Express API scaffold with TypeScript and Zod. It requires Node.js 22.18 or later and pnpm 12.11.2.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

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

The application factory in `src/app.ts` wires the router to an injectable controller, and `src/server.ts` starts the listener using `src/config`. Routes compose parsing and validation middleware with schemas from `src/schemas`. The `src/services` and `src/repositories` directories are reserved for business logic and persistence.
