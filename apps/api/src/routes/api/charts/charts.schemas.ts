import { z } from 'zod';

export const chartBoardJsonSchema = z.object({
  instances: z.array(z.unknown()).default([]),
  layout: z.array(z.unknown()).default([]),
});

export const createChartSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  board_json: chartBoardJsonSchema.optional(),
  is_overview: z.boolean().optional(),
  id: z.uuid().optional(),
});

export const updateChartSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  board_json: chartBoardJsonSchema.optional(),
  is_overview: z.boolean().optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const shareChartSchema = z.object({
  userIds: z.array(z.uuid()).min(1).max(50),
});

export type CreateChartBody = z.infer<typeof createChartSchema>;
export type UpdateChartBody = z.infer<typeof updateChartSchema>;
export type ShareChartBody = z.infer<typeof shareChartSchema>;
