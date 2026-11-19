import type { ReportType } from '@repo/types/api/v1';

export function reportMarkdownFilename(
  reportType: ReportType,
  reportDate: string
): string {
  return `${reportType}-report-${reportDate}.md`;
}

export function createReportMarkdownFile(
  markdown: string,
  reportType: ReportType,
  reportDate: string
): { readonly blob: Blob; readonly filename: string } {
  return {
    blob: new Blob([markdown], { type: 'text/markdown;charset=utf-8' }),
    filename: reportMarkdownFilename(reportType, reportDate),
  };
}

export function downloadReportMarkdown(
  markdown: string,
  reportType: ReportType,
  reportDate: string
): void {
  const { blob, filename } = createReportMarkdownFile(
    markdown,
    reportType,
    reportDate
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
