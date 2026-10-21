'use client';

import {
  generateReportRequestSchema,
  generateReportResponseSchema,
  type GenerateReportRequest,
  type GenerateReportResponse,
} from '@repo/types/api/v1';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { formatZodError } from '@/lib/zod/format-zod-error';

export async function generateDailyReport(
  input: GenerateReportRequest
): Promise<GenerateReportResponse> {
  const request = generateReportRequestSchema.safeParse(input);
  if (!request.success) {
    throw new Error(formatZodError(request.error));
  }

  const response = await apiFetch<{ data: unknown }>(
    '/api/v1/reports/generate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.data),
    }
  );
  const report = generateReportResponseSchema.safeParse(response.data);
  if (!report.success) {
    throw new Error(`Invalid report response: ${formatZodError(report.error)}`);
  }
  return report.data;
}
