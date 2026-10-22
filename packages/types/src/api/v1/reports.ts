import { z } from 'zod';
import { WORK_ITEM_PRIORITIES } from '../../work-item-priorities.js';
import { WORKFLOW_STATE_CATEGORIES } from '../../work-item-state.js';
import { WORK_ITEM_TYPES } from '../../work-item-types.js';

/** Supported report variants; add Sprint and Review schemas to this union later. */
export const REPORT_TYPES = ['daily'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_VERBOSITIES = ['concise', 'standard', 'detailed'] as const;
export const reportVerbositySchema = z.enum(REPORT_VERBOSITIES);
export type ReportVerbosity = z.infer<typeof reportVerbositySchema>;

export const DAILY_REPORT_AI_INSIGHTS_STATUSES = [
  'not_requested',
  'generated',
  'unavailable',
] as const;
export const dailyReportAiInsightsStatusSchema = z.enum(
  DAILY_REPORT_AI_INSIGHTS_STATUSES
);
export type DailyReportAiInsightsStatus = z.infer<
  typeof dailyReportAiInsightsStatusSchema
>;

const DAILY_REPORT_AI_INSIGHT_MAX_ITEMS = 20;
const DAILY_REPORT_AI_INSIGHT_MAX_LENGTH = 1000;
const dailyReportAiInsightTextSchema = z
  .string()
  .min(1)
  .max(DAILY_REPORT_AI_INSIGHT_MAX_LENGTH);
const dailyReportAiInsightListSchema = z
  .array(dailyReportAiInsightTextSchema)
  .max(DAILY_REPORT_AI_INSIGHT_MAX_ITEMS);

export const dailyReportAiInsightsSchema = z
  .object({
    completedWork: dailyReportAiInsightListSchema,
    importantInProgress: dailyReportAiInsightListSchema,
    pendingTasks: dailyReportAiInsightListSchema,
    blockedAndOverdue: dailyReportAiInsightListSchema,
    potentialRisks: dailyReportAiInsightListSchema,
    upcomingDeadlines: dailyReportAiInsightListSchema,
    nextPriorities: dailyReportAiInsightListSchema,
    overallProgress: dailyReportAiInsightTextSchema,
  })
  .strict();
export type DailyReportAiInsights = z.infer<typeof dailyReportAiInsightsSchema>;

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const reportDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(isCalendarDate, 'Date must be a valid calendar date');

export const ianaTimezoneSchema = z
  .string()
  .trim()
  .min(1, 'Timezone is required')
  .max(100)
  .refine(isIanaTimezone, 'Timezone must be a valid IANA timezone');

const optionalIdFilterSchema = z.array(z.uuid()).min(1).max(100).optional();

/**
 * The discriminator is intentionally required so Sprint and Review request
 * variants can be added without changing the generate endpoint shape.
 */
export const dailyReportRequestSchema = z
  .object({
    reportType: z.literal('daily'),
    reportDate: reportDateSchema,
    timezone: ianaTimezoneSchema,
    projectIds: optionalIdFilterSchema,
    sprintIds: optionalIdFilterSchema,
    verbosity: reportVerbositySchema.default('standard'),
    includeAiInsights: z.boolean().default(false),
  })
  .strict();

export const generateReportRequestSchema = dailyReportRequestSchema;
type DailyReportRequestInput = z.input<typeof dailyReportRequestSchema>;
export type DailyReportRequest = Omit<DailyReportRequestInput, 'verbosity'> & {
  verbosity: ReportVerbosity;
};
export type GenerateReportRequest = Omit<
  z.input<typeof generateReportRequestSchema>,
  'verbosity'
> & {
  verbosity: ReportVerbosity;
};

export const dailyReportWorkItemSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  type: z.enum(WORK_ITEM_TYPES),
  priority: z.enum(WORK_ITEM_PRIORITIES),
  project: z.object({
    id: z.string().min(1),
    key: z.string(),
    name: z.string(),
  }),
  sprint: z
    .object({
      id: z.string().min(1),
      name: z.string(),
    })
    .nullable(),
  dueDate: reportDateSchema.nullable(),
  storyPoints: z.number().int().nullable(),
  statusCategory: z.enum(WORKFLOW_STATE_CATEGORIES),
  stateId: z.string(),
  doneAt: z.string().datetime({ offset: true }).nullable(),
});
export type DailyReportWorkItem = z.infer<typeof dailyReportWorkItemSchema>;

export const dailyReportSummarySchema = z.object({
  completed: z.number().int().nonnegative(),
  inProgress: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  dueToday: z.number().int().nonnegative(),
  overdue: z.number().int().nonnegative(),
  upcomingDeadlines: z.number().int().nonnegative(),
});

export const dailyReportSnapshotSchema = z.object({
  reportDate: reportDateSchema,
  timezone: ianaTimezoneSchema,
  utcRange: z.object({
    start: z.string().datetime({ offset: true }),
    endExclusive: z.string().datetime({ offset: true }),
  }),
  summary: dailyReportSummarySchema,
  completed: z.array(dailyReportWorkItemSchema),
  inProgress: z.array(dailyReportWorkItemSchema),
  pending: z.array(dailyReportWorkItemSchema),
  blocked: z.array(dailyReportWorkItemSchema),
  dueToday: z.array(dailyReportWorkItemSchema),
  overdue: z.array(dailyReportWorkItemSchema),
  upcomingDeadlines: z.array(dailyReportWorkItemSchema),
});
export type DailyReportSnapshot = z.infer<typeof dailyReportSnapshotSchema>;

export const dailyReportMetadataSchema = z.object({
  reportType: z.literal('daily'),
  generatedAt: z.string().datetime({ offset: true }),
  reportDate: reportDateSchema,
  timezone: ianaTimezoneSchema,
  verbosity: reportVerbositySchema,
  filters: z.object({
    projectIds: z.array(z.uuid()),
    sprintIds: z.array(z.uuid()),
  }),
  upcomingDeadlineDays: z.number().int().positive(),
});
export type DailyReportMetadata = z.infer<typeof dailyReportMetadataSchema>;

export const generateReportResponseSchema = z.object({
  snapshot: dailyReportSnapshotSchema,
  markdown: z.string(),
  metadata: dailyReportMetadataSchema,
  aiInsights: dailyReportAiInsightsSchema.optional(),
  aiInsightsStatus: dailyReportAiInsightsStatusSchema.optional(),
});
export type GenerateReportResponse = z.infer<
  typeof generateReportResponseSchema
>;
