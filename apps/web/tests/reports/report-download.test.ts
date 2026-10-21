import { describe, expect, it } from 'vitest';
import {
  createReportMarkdownFile,
  reportMarkdownFilename,
} from '@/app/reports/_helpers/report-download';

describe('report Markdown download', () => {
  it('uses the report type and date in the filename', () => {
    expect(reportMarkdownFilename('daily', '2026-10-20')).toBe(
      'daily-report-2026-10-20.md'
    );
  });

  it('preserves the exact Markdown returned by the API', async () => {
    const markdown = '# Daily Report\n\n- Exact `content`\n';
    const file = createReportMarkdownFile(markdown, 'daily', '2026-10-20');

    expect(file.filename).toBe('daily-report-2026-10-20.md');
    expect(file.blob.type).toBe('text/markdown;charset=utf-8');
    await expect(file.blob.text()).resolves.toBe(markdown);
  });
});
