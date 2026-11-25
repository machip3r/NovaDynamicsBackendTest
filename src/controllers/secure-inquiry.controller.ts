import type { RequestHandler } from 'express';

export const submitSecureInquiry: RequestHandler = (_request, response) => {
  response.status(200).json({ received: true });
};
