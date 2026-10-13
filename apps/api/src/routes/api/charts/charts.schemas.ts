import { z } from 'zod';

const chartWorkspaceScopeSchema = z.object({
  projectId: z.uuid(),
  sprintId: z.uuid(),
});

export const chartBoardJsonSchema = z.object({
  instances: z.array(z.unknown()).default([]),
  layout: z.array(z.unknown()).default([]),
  /** When set, the board is locked to this project + sprint. */
  scope: chartWorkspaceScopeSchema.nullable().optional(),
});

export const createChartSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  board_json: chartBoardJsonSchema.optional(),
  show_on_dashboard: z.boolean().optional(),
  dashboard_sort_order: z.number().int().min(0).max(1_000_000).optional(),
  id: z.uuid().optional(),
});

export const updateChartSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  board_json: chartBoardJsonSchema.optional(),
  show_on_dashboard: z.boolean().optional(),
  dashboard_sort_order: z.number().int().min(0).max(1_000_000).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const shareChartSchema = z.object({
  userIds: z.array(z.uuid()).min(1).max(50),
});

export type CreateChartBody = z.infer<typeof createChartSchema>;
export type UpdateChartBody = z.infer<typeof updateChartSchema>;
export type ShareChartBody = z.infer<typeof shareChartSchema>;
