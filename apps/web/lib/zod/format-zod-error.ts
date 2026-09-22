import { z } from 'zod';

/** Format Zod validation errors for mutation client error messages. */
export function formatZodError(error: z.ZodError): string {
  const messages = error.issues.map((issue) => issue.message);
  return [...new Set(messages)].join('; ');
}

/** Parse client input with a Zod schema or throw a formatted validation error. */
export function parseWithZod<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data;
}
