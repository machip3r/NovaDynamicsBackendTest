import type { RequestHandler } from 'express';
import { errorResponse, successResponse } from '../http/api-response.ts';
import type { InquiryResult } from '../repositories/audit.repository.ts';
import type { SecureInquiry } from '../schemas/secure-inquiry.schema.ts';

export function createSecureInquiryController(
  processInquiry: (inquiry: SecureInquiry) => Promise<InquiryResult>,
): RequestHandler {
  return async (request, response) => {
    const result = await processInquiry(request.body);

    switch (result) {
      case 'service_busy':
        response.status(503).json(errorResponse('Service Busy'));
        break;
      case 'failure':
        response.status(502).json(errorResponse('AI request failed.'));
        break;
      case 'success':
        response.status(200).json(successResponse());
        break;
    }
  };
}
