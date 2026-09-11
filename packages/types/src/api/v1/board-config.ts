import { z } from 'zod';
import { BOARD_WORK_ITEM_STATUSES } from '../../work-item-status.js';

const boardWorkItemStatusSchema = z.enum(BOARD_WORK_ITEM_STATUSES, {
  message: 'Please select a valid board status',
});

export const boardColumnSchema = z.object({
  id: z.string().trim().min(1, 'Column ID is required'),
  name: z.string().trim().min(1, 'Column name is required'),
  status: boardWorkItemStatusSchema,
});

export const boardConfigSchema = z.object({
  version: z.literal('1'),
  columns: z
    .array(boardColumnSchema)
    .min(1, 'Board must have at least one column')
    .refine(
      (columns) =>
        new Set(columns.map((column) => column.id)).size === columns.length,
      'Column IDs must be unique'
    ),
});

export type BoardColumn = z.infer<typeof boardColumnSchema>;
export type BoardConfig = z.infer<typeof boardConfigSchema>;
