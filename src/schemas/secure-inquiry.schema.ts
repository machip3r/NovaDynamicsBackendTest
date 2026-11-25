import { z } from 'zod';

export const secureInquirySchema = z.object({
  userId: z.string({ error: 'Provide userId as a string.' }),
  message: z.string({ error: 'Provide message as a string.' }),
}, { error: 'Send a JSON object with userId and message fields.' });

export type SecureInquiry = z.infer<typeof secureInquirySchema>;
