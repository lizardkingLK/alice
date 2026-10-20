import { describe, expect, it } from 'vitest';
import {
  dailyReportUtcRange,
  ReportTimezoneError,
} from '../../src/routes/api/reports/reports.timezone';

describe('dailyReportUtcRange', () => {
  it('uses the requested IANA timezone instead of server-local midnight', () => {
    expect(dailyReportUtcRange('2026-10-20', 'Asia/Colombo')).toEqual({
      start: new Date('2026-10-19T18:30:00.000Z'),
      endExclusive: new Date('2026-10-20T18:30:00.000Z'),
    });
  });

  it('returns a 23-hour UTC range across a spring DST transition', () => {
    const range = dailyReportUtcRange('2026-03-08', 'America/New_York');

    expect(range.start).toEqual(new Date('2026-03-08T05:00:00.000Z'));
    expect(range.endExclusive).toEqual(new Date('2026-03-09T04:00:00.000Z'));
    expect(range.endExclusive.getTime() - range.start.getTime()).toBe(
      23 * 60 * 60 * 1000
    );
  });

  it('returns a 25-hour UTC range across a fall DST transition', () => {
    const range = dailyReportUtcRange('2026-11-01', 'America/New_York');

    expect(range.start).toEqual(new Date('2026-11-01T04:00:00.000Z'));
    expect(range.endExclusive).toEqual(new Date('2026-11-02T05:00:00.000Z'));
  });

  it('uses the first valid instant when a historical DST jump skipped midnight', () => {
    const range = dailyReportUtcRange('2018-11-04', 'America/Sao_Paulo');

    expect(range.start).toEqual(new Date('2018-11-04T03:00:00.000Z'));
    expect(range.endExclusive).toEqual(new Date('2018-11-05T02:00:00.000Z'));
  });

  it('rejects a calendar date that did not exist in the requested timezone', () => {
    expect(() => dailyReportUtcRange('2011-12-30', 'Pacific/Apia')).toThrow(
      ReportTimezoneError
    );
  });
});
