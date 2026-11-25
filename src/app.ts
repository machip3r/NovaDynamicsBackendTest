import express, { type RequestHandler } from 'express';
import { errorResponse } from './http/api-response.ts';
import { handleRequestError } from './middleware/request-error.middleware.ts';
import { createSecureInquiryRouter } from './routes/secure-inquiry.routes.ts';

export function createApp(handleInquiry: RequestHandler) {
  const app = express();

  app.disable('x-powered-by');
  app.use(createSecureInquiryRouter(handleInquiry));
  app.use((_request, response) => {
    response.status(404).json(errorResponse('Route not found.'));
  });
  app.use(handleRequestError);

  return app;
}
