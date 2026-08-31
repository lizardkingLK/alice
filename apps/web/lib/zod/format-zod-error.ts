import { z } from 'zod';

/** Serialize Zod validation errors for mutation client error messages. */
export function formatZodError(error: z.ZodError): string {
  return JSON.stringify(z.treeifyError(error));
}

/** Parse client input with a Zod schema or throw a formatted validation error. */
export function parseWithZod<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data;
}
