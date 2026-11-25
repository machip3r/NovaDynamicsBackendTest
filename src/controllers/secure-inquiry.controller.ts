import type { RequestHandler } from 'express';
import { errorResponse, successResponse } from '../http/api-response.ts';
import type { SecureInquiry } from '../schemas/secure-inquiry.schema.ts';
import { CircuitOpenError } from '../services/circuit-breaker.service.ts';

export function createSecureInquiryController(
  generateAnswer: (message: string) => Promise<string>,
): RequestHandler {
  return async (request, response) => {
    const { message }: SecureInquiry = request.body;

    try {
      await generateAnswer(message);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        response.status(503).json(errorResponse('Service Busy'));
        return;
      }

      response.status(502).json(errorResponse('AI request failed.'));
      return;
    }

    response.status(200).json(successResponse());
  };
}
