import express, { Router, type RequestHandler, type Response } from 'express';
import multer, { type Multer } from 'multer';
import { z } from 'zod';
import { createWorkLogSchema, listWorkLogsQuerySchema } from '@repo/types';
import {
  requireApiAuth,
  type AuthenticatedRequest,
} from '../../../middlewares/auth';
import {
  WorkItemAccessError,
  WorkItemValidationError,
} from '../work-items/work-items.errors';
import { WorklogExcelValidationError } from './worklogs.excel';
import { WorklogsService } from './worklogs.service';

const MAX_WORKLOG_EXCEL_FILE_SIZE = 2 * 1024 * 1024;
const WORKLOG_EXCEL_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const excelUpload: Multer = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_WORKLOG_EXCEL_FILE_SIZE,
    files: 1,
  },
});

const receiveExcelUpload: RequestHandler = (req, res, next) => {
  excelUpload.single('file')(req, res, (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: 'The .xlsx file must not exceed 2 MB.',
        });
        return;
      }
      res.status(400).json({ error: 'Unable to read the uploaded file.' });
      return;
    }
    if (error) {
      res.status(400).json({ error: 'Unable to read the uploaded file.' });
      return;
    }
    next();
  });
};

function getExcelUpload(
  req: AuthenticatedRequest,
  res: Response
): { workItemId: string; input: Buffer } | null {
  const parsed = listWorkLogsQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: z.treeifyError(parsed.error) });
    return null;
  }

  if (!req.file?.originalname.toLowerCase().endsWith('.xlsx')) {
    res.status(400).json({ error: 'An .xlsx file is required.' });
    return null;
  }

  return {
    workItemId: parsed.data.work_item_id,
    input: req.file.buffer,
  };
}

export type WorklogsRouterDeps = {
  worklogsService: WorklogsService;
};

function sendWorkLogMutationError(
  res: {
    status: (code: number) => {
      json: (body: Record<string, unknown>) => void;
    };
  },
  error: unknown,
  fallbackMessage: string
) {
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (error instanceof WorkItemAccessError) {
    return res.status(403).json({ error: message });
  }

  if (error instanceof WorkItemValidationError) {
    return res.status(400).json({ error: message });
  }

  if (error instanceof WorklogExcelValidationError) {
    return res.status(400).json({
      error: message,
      errors: error.issues.map((issue) => ({
        row_number: issue.rowNumber,
        ...(issue.field ? { field: issue.field } : {}),
        message: issue.message,
      })),
    });
  }

  if (/work item not found/i.test(message)) {
    return res.status(404).json({ error: message });
  }

  return res.status(500).json({ error: message });
}

export function createWorklogsRouter(deps: WorklogsRouterDeps): Router {
  const { worklogsService } = deps;
  const worklogsRouter: Router = express.Router();

  worklogsRouter.get(
    '/template',
    requireApiAuth,
    async (_req: AuthenticatedRequest, res) => {
      try {
        const template = await worklogsService.createExcelTemplate();
        res.setHeader('Content-Type', WORKLOG_EXCEL_CONTENT_TYPE);
        res.setHeader(
          'Content-Disposition',
          'attachment; filename="worklog-upload-template.xlsx"'
        );
        return res.send(template);
      } catch (error) {
        return sendWorkLogMutationError(
          res,
          error,
          'Failed to create worklog Excel template'
        );
      }
    }
  );

  worklogsRouter.post(
    '/preview',
    requireApiAuth,
    receiveExcelUpload,
    async (req: AuthenticatedRequest, res) => {
      const upload = getExcelUpload(req, res);
      if (!upload) return;

      try {
        const preview = await worklogsService.previewExcelWorklogs(
          req.userId!,
          upload.workItemId,
          upload.input
        );
        return res.json({
          row_count: preview.rows.length,
          rows: preview.rows.map((row) => ({
            row_number: row.rowNumber,
            start_at: row.startAt,
            end_at: row.endAt,
            logged_hours: row.loggedHours,
            description: row.description,
          })),
        });
      } catch (error) {
        return sendWorkLogMutationError(
          res,
          error,
          'Failed to preview worklog Excel upload'
        );
      }
    }
  );

  worklogsRouter.post(
    '/import',
    requireApiAuth,
    receiveExcelUpload,
    async (req: AuthenticatedRequest, res) => {
      const upload = getExcelUpload(req, res);
      if (!upload) return;

      try {
        const result = await worklogsService.importExcelWorklogs(
          req.userId!,
          upload.workItemId,
          upload.input
        );
        return res.status(201).json({ imported_count: result.importedCount });
      } catch (error) {
        return sendWorkLogMutationError(
          res,
          error,
          'Failed to import worklog Excel upload'
        );
      }
    }
  );

  /**
   * Unused Express list path (Prisma). Next still lists via RSC supabase-js.
   */
  worklogsRouter.get(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = listWorkLogsQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      try {
        const rows = await worklogsService.listByWorkItemId(
          parsed.data.work_item_id,
          req.userId!
        );
        return res.json(rows);
      } catch (error) {
        return sendWorkLogMutationError(res, error, 'Failed to list work logs');
      }
    }
  );

  worklogsRouter.post(
    '/',
    requireApiAuth,
    async (req: AuthenticatedRequest, res) => {
      const parsed = createWorkLogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) });
      }

      const dateOnly =
        parsed.data.logged_at ?? new Date().toISOString().slice(0, 10);
      const loggedAtIso = new Date(`${dateOnly}T00:00:00.000Z`).toISOString();

      try {
        const worklog = await worklogsService.createWorkLog(req.userId!, {
          workItemId: parsed.data.work_item_id,
          loggedHours: parsed.data.logged_hours,
          loggedAtIso,
          comment: parsed.data.comment ?? null,
        });

        return res.status(201).json({ worklog });
      } catch (error) {
        return sendWorkLogMutationError(
          res,
          error,
          'Failed to create work log'
        );
      }
    }
  );

  return worklogsRouter;
}
