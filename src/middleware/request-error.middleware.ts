import type { ErrorRequestHandler } from 'express';

export const handleRequestError: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const status = error && typeof error === 'object' && 'status' in error
    ? error.status
    : undefined;

  switch (status) {
    case 400:
      response.status(400).json({ error: 'Send a valid JSON request body.' });
      break;
    case 413:
      response.status(413).json({ error: 'The request body is too large.' });
      break;
    case 415:
      response.status(415).json({ error: 'Use a supported JSON encoding.' });
      break;
    default:
      response.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
