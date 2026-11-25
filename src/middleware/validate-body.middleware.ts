import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';
import { errorResponse } from '../http/api-response.ts';

export function validateBody(schema: ZodType): RequestHandler {
  return (request, response, next) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      const issues = result.error.issues.map(({ path, message }) => ({
        field: path.join('.') || 'body',
        message,
      }));
      response.status(400).json(errorResponse('Invalid request body.', { issues }));
      return;
    }

    request.body = result.data;
    next();
  };
}
