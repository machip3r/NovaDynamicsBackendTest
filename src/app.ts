import express, { type RequestHandler } from 'express';
import { handleRequestError } from './middleware/request-error.middleware.ts';
import { createSecureInquiryRouter } from './routes/secure-inquiry.routes.ts';

export function createApp(handleInquiry: RequestHandler) {
  const app = express();

  app.disable('x-powered-by');
  app.use(createSecureInquiryRouter(handleInquiry));
  app.use(handleRequestError);

  return app;
}
