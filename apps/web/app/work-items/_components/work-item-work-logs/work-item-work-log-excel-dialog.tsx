'use client';

import { useEffect, useState } from 'react';
import type {
  WorklogExcelPreviewResponse,
  WorklogExcelValidationIssue,
} from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Dropzone, type FileRejection } from '@repo/ui/components/ui/dropzone';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { FileSpreadsheet, Loader2, UploadCloud } from '@repo/ui/lib/icons';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  importWorkItemWorkLogsExcel,
  previewWorkItemWorkLogsExcel,
} from '@/app/worklogs/_services/worklogs.mutations.client';

const MAX_EXCEL_BYTES = 2 * 1024 * 1024;
const EXCEL_ACCEPT = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
    '.xlsx',
  ],
};

type WorkItemWorkLogExcelDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- open-change callback
  readonly onOpenChange: (open: boolean) => void;
  readonly workItemId: string;
  // eslint-disable-next-line no-unused-vars -- import callback
  readonly onImported: (count: number) => void | Promise<void>;
};

function isValidationIssue(
  value: unknown
): value is WorklogExcelValidationIssue {
  if (typeof value !== 'object' || value === null) return false;
  const issue = value as Partial<WorklogExcelValidationIssue>;
  return (
    typeof issue.row_number === 'number' && typeof issue.message === 'string'
  );
}

function validationIssuesFrom(error: unknown): WorklogExcelValidationIssue[] {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return [];
  return error.details.filter(isValidationIssue);
}

function formatUtcDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date);
}

function formatLoggedHours(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(6)));
}

function dropzoneTitle(isPreviewing: boolean, file: File | null): string {
  if (isPreviewing) return 'Validating workbook…';
  return file?.name ?? 'Drag an Excel workbook here';
}

function DropzoneIcon({
  isPreviewing,
  hasFile,
}: Readonly<{
  isPreviewing: boolean;
  hasFile: boolean;
}>) {
  if (isPreviewing) {
    return <Loader2 className="size-5 animate-spin" />;
  }
  if (hasFile) {
    return <FileSpreadsheet className="size-5" />;
  }
  return <UploadCloud className="size-5" />;
}

export function WorkItemWorkLogExcelDialog({
  open,
  onOpenChange,
  workItemId,
  onImported,
}: Readonly<WorkItemWorkLogExcelDialogProps>) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WorklogExcelPreviewResponse | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<
    WorklogExcelValidationIssue[]
  >([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) return;
    setFile(null);
    setPreview(null);
    setErrorMessage(null);
    setValidationIssues([]);
    setIsPreviewing(false);
    setIsImporting(false);
    setConfirming(false);
  }, [open]);

  const previewFile = async (nextFile: File) => {
    setFile(nextFile);
    setPreview(null);
    setErrorMessage(null);
    setValidationIssues([]);
    setConfirming(false);
    setIsPreviewing(true);
    try {
      setPreview(await previewWorkItemWorkLogsExcel(workItemId, nextFile));
    } catch (error) {
      setValidationIssues(validationIssuesFrom(error));
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to preview the file.'
      );
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDrop = (
    acceptedFiles: File[],
    fileRejections: FileRejection[]
  ) => {
    const nextFile = acceptedFiles[0];
    if (fileRejections.length > 0 || !nextFile) {
      setFile(null);
      setPreview(null);
      setValidationIssues([]);
      setErrorMessage('Choose an .xlsx file no larger than 2 MB.');
      return;
    }
    void previewFile(nextFile);
  };

  const handleImport = async () => {
    if (!file || !preview) return;
    setIsImporting(true);
    setErrorMessage(null);
    try {
      const result = await importWorkItemWorkLogsExcel(workItemId, file);
      await onImported(result.imported_count);
      onOpenChange(false);
    } catch (error) {
      setValidationIssues(validationIssuesFrom(error));
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to import worklogs.'
      );
      setConfirming(false);
    } finally {
      setIsImporting(false);
    }
  };

  const rowLabel = preview?.row_count === 1 ? 'worklog' : 'worklogs';

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isImporting) onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
        dismissOnOutsideClick={!isImporting}
      >
        <DialogHeader>
          <DialogTitle>Upload worklogs from Excel</DialogTitle>
          <DialogDescription>
            Preview an .xlsx file before saving every valid row to this work
            item.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Dropzone
            multiple={false}
            maxFiles={1}
            maxSize={MAX_EXCEL_BYTES}
            accept={EXCEL_ACCEPT}
            disabled={isPreviewing || isImporting}
            onDrop={handleDrop}
            className="min-h-32 py-5 sm:min-h-32 sm:py-5"
          >
            <div className="flex items-center gap-3 text-left">
              <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full">
                <DropzoneIcon
                  isPreviewing={isPreviewing}
                  hasFile={Boolean(file)}
                />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {dropzoneTitle(isPreviewing, file)}
                </p>
                <p className="text-muted-foreground text-xs">
                  Click to browse · .xlsx only · maximum 2 MB and 200 rows
                </p>
              </div>
            </div>
          </Dropzone>

          {errorMessage ? (
            <div
              className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm"
              role="alert"
            >
              <p className="font-medium">{errorMessage}</p>
              {validationIssues.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validationIssues.map((issue, index) => (
                    <li
                      key={`${issue.row_number}-${issue.field ?? ''}-${index}`}
                    >
                      Row {issue.row_number}
                      {issue.field ? ` · ${issue.field}` : ''}: {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {preview ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-medium">Preview</h3>
                <span className="text-muted-foreground text-xs">
                  {preview.row_count} {rowLabel} · times shown in UTC
                </span>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Start (UTC)</TableHead>
                      <TableHead>End (UTC)</TableHead>
                      <TableHead className="text-right">
                        Calculated hours
                      </TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.row_number}>
                        <TableCell>{row.row_number}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatUtcDateTime(row.start_at)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatUtcDateTime(row.end_at)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatLoggedHours(row.logged_hours)}
                        </TableCell>
                        <TableCell>{row.description || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}

          {confirming && preview ? (
            <div className="bg-muted/50 rounded-lg border p-4">
              <p className="font-medium">
                Save {preview.row_count} {rowLabel}?
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                All previewed rows will be saved for you on this work item.
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {confirming ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isImporting}
                onClick={() => setConfirming(false)}
              >
                Back
              </Button>
              <Button
                type="button"
                disabled={isImporting}
                onClick={() => void handleImport()}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  'Confirm import'
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={isPreviewing || isImporting}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!preview || isPreviewing || isImporting}
                onClick={() => setConfirming(true)}
              >
                {preview
                  ? `Import ${preview.row_count} ${rowLabel}`
                  : 'Import worklogs'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
