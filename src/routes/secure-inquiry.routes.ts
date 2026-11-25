import { json, Router, type RequestHandler } from 'express';
import { validateBody } from '../middleware/validate-body.middleware.ts';
import { secureInquirySchema } from '../schemas/secure-inquiry.schema.ts';

export function createSecureInquiryRouter(handleInquiry: RequestHandler) {
  const router = Router();

  router.post(
    '/secure-inquiry',
    json({ strict: false }),
    validateBody(secureInquirySchema),
    handleInquiry,
  );

  return router;
}
