import { z } from 'zod';

/** Serialize Zod validation errors for mutation client error messages. */
export function formatZodError(error: z.ZodError): string {
  return JSON.stringify(z.treeifyError(error));
}
