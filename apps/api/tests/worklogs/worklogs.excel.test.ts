import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import {
  MAX_WORKLOG_EXCEL_DATA_ROWS,
  WORKLOG_EXCEL_HEADERS,
  WORKLOG_EXCEL_SHEET_NAME,
  WorklogExcelValidationError,
  createWorklogExcelTemplate,
  parseWorklogExcel,
} from '../../src/routes/api/worklogs/worklogs.excel';

type CellInput = ExcelJS.CellValue;

async function workbookBuffer(
  rows: ReadonlyArray<readonly [CellInput, CellInput, CellInput]>,
  headers: readonly string[] = WORKLOG_EXCEL_HEADERS
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(WORKLOG_EXCEL_SHEET_NAME);
  sheet.addRow([...headers]);
  rows.forEach((row) => sheet.addRow([...row]));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function validationErrors(
  input: Buffer
): Promise<WorklogExcelValidationError> {
  try {
    await parseWorklogExcel(input);
  } catch (error) {
    expect(error).toBeInstanceOf(WorklogExcelValidationError);
    return error as WorklogExcelValidationError;
  }
  throw new Error('Expected worklog workbook validation to fail');
}

describe('worklog Excel template', () => {
  it('creates an xlsx template with the documented columns and formats', async () => {
    const template = await createWorklogExcelTemplate();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(template).buffer);

    const worklogs = workbook.getWorksheet(WORKLOG_EXCEL_SHEET_NAME);
    expect(worklogs).toBeDefined();
    expect(worklogs?.getRow(1).values).toEqual([
      undefined,
      ...WORKLOG_EXCEL_HEADERS,
    ]);
    expect(worklogs?.getColumn(1).numFmt).toBe('yyyy-mm-dd hh:mm');
    expect(worklogs?.getColumn(2).numFmt).toBe('yyyy-mm-dd hh:mm');

    const instructions = workbook.getWorksheet('Instructions');
    expect(instructions?.getCell('A4').text).toContain('YYYY-MM-DD HH:mm');
    expect(instructions?.getCell('A5').text).toContain('UTC');
    expect(instructions?.getCell('A6').text).toContain('next calendar date');
  });
});

describe('parseWorklogExcel', () => {
  it('parses real Excel date cells and calculates hours', async () => {
    const input = await workbookBuffer([
      [
        new Date('2026-11-05T08:30:00.000Z'),
        new Date('2026-11-05T11:00:00.000Z'),
        'Implemented worklog validation',
      ],
    ]);

    await expect(parseWorklogExcel(input)).resolves.toEqual([
      {
        rowNumber: 2,
        startAt: '2026-11-05T08:30:00.000Z',
        endAt: '2026-11-05T11:00:00.000Z',
        loggedHours: 2.5,
        description: 'Implemented worklog validation',
      },
    ]);
  });

  it('accepts documented text values with spaces, ISO separators, and seconds', async () => {
    const input = await workbookBuffer([
      ['2026-11-05 08:30', '2026-11-05 09:45', 'Space format'],
      ['2026-11-05T10:00:15', '2026-11-05T11:30:45', 'ISO local'],
      ['2026-11-05T12:00:00Z', '2026-11-05T13:00:00Z', 'ISO UTC'],
      ['2026-11-05T15:30:00+05:30', '2026-11-05T17:00:00+05:30', 'ISO offset'],
    ]);

    const rows = await parseWorklogExcel(input);

    expect(rows.map((row) => row.loggedHours)).toEqual([
      1.25, 1.5083333333333333, 1, 1.5,
    ]);
    expect(rows.map((row) => row.startAt)).toEqual([
      '2026-11-05T08:30:00.000Z',
      '2026-11-05T10:00:15.000Z',
      '2026-11-05T12:00:00.000Z',
      '2026-11-05T10:00:00.000Z',
    ]);
  });

  it('skips fully blank rows while preserving Excel row numbers', async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(WORKLOG_EXCEL_SHEET_NAME);
    sheet.addRow([...WORKLOG_EXCEL_HEADERS]);
    sheet.getRow(2).height = 15;
    sheet.getCell('A3').value = '';
    sheet.getCell('B3').value = '   ';
    sheet.getCell('C3').value = '';
    sheet.getCell('A4').value = '2026-11-05 08:00';
    sheet.getCell('B4').value = '2026-11-05 09:00';
    sheet.getCell('C4').value = 'Valid row';
    const input = Buffer.from(await workbook.xlsx.writeBuffer());

    const rows = await parseWorklogExcel(input);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.rowNumber).toBe(4);
  });

  it('supports overnight entries when the end uses the next calendar date', async () => {
    const input = await workbookBuffer([
      ['2026-11-05 23:30', '2026-11-06 01:15', 'Overnight support'],
    ]);

    await expect(parseWorklogExcel(input)).resolves.toEqual([
      expect.objectContaining({
        rowNumber: 2,
        loggedHours: 1.75,
      }),
    ]);
  });

  it('rejects invalid dates with Excel row numbers', async () => {
    const input = await workbookBuffer([
      ['2026-02-30 09:00', '2026-02-30 10:00', 'Impossible date'],
    ]);

    const error = await validationErrors(input);

    expect(error.issues).toEqual([
      {
        rowNumber: 2,
        field: 'Start Date/Time',
        message:
          'Start Date/Time must be an Excel date/time or text in YYYY-MM-DD HH:mm[:ss] or ISO 8601 format.',
      },
      {
        rowNumber: 2,
        field: 'End Date/Time',
        message:
          'End Date/Time must be an Excel date/time or text in YYYY-MM-DD HH:mm[:ss] or ISO 8601 format.',
      },
    ]);
  });

  it('rejects end values that are not later than start', async () => {
    const input = await workbookBuffer([
      ['2026-11-05 10:00', '2026-11-05 10:00', 'Same time'],
      ['2026-11-05 11:00', '2026-11-05 10:00', 'Earlier end'],
    ]);

    const error = await validationErrors(input);

    expect(error.issues).toEqual([
      {
        rowNumber: 2,
        field: 'End Date/Time',
        message: 'End Date/Time must be later than Start Date/Time.',
      },
      {
        rowNumber: 3,
        field: 'End Date/Time',
        message: 'End Date/Time must be later than Start Date/Time.',
      },
    ]);
  });

  it('rejects durations over 1000 hours and descriptions over 2000 characters', async () => {
    const input = await workbookBuffer([
      ['2026-01-01 00:00', '2026-02-12 00:01', 'Too long'],
      ['2026-11-05 09:00', '2026-11-05 10:00', 'x'.repeat(2001)],
    ]);

    const error = await validationErrors(input);

    expect(error.issues).toEqual([
      {
        rowNumber: 2,
        field: 'End Date/Time',
        message: 'Duration must not exceed 1000 hours.',
      },
      {
        rowNumber: 3,
        field: 'Description',
        message: 'Description must not exceed 2000 characters.',
      },
    ]);
  });

  it('accepts the exact duration and description limits', async () => {
    const input = await workbookBuffer([
      ['2026-01-01 00:00', '2026-02-11 16:00', `  ${'x'.repeat(2000)}  `],
    ]);

    const rows = await parseWorklogExcel(input);

    expect(rows[0]?.loggedHours).toBe(1000);
    expect(rows[0]?.description).toHaveLength(2000);
  });

  it('rejects partial rows and the entire workbook when any row is invalid', async () => {
    const input = await workbookBuffer([
      ['2026-11-05 08:00', '2026-11-05 09:00', 'Valid row'],
      ['2026-11-05 10:00', null, 'Missing end'],
    ]);

    const error = await validationErrors(input);

    expect(error.issues).toEqual([
      {
        rowNumber: 3,
        field: 'End Date/Time',
        message: 'End Date/Time is required.',
      },
    ]);
  });

  it('rejects malformed xlsx input', async () => {
    const error = await validationErrors(Buffer.from('not an xlsx file'));

    expect(error.issues).toEqual([
      {
        rowNumber: 1,
        message: 'The file is not a valid .xlsx workbook.',
      },
    ]);
  });

  it('rejects workbooks without the exact required headers', async () => {
    const input = await workbookBuffer([], ['Started', 'Ended', 'Description']);

    const error = await validationErrors(input);

    expect(error.issues).toEqual([
      {
        rowNumber: 1,
        message:
          'Expected columns: Start Date/Time, End Date/Time, Description.',
      },
    ]);
  });

  it('rejects unexpected columns', async () => {
    const input = await workbookBuffer(
      [],
      [...WORKLOG_EXCEL_HEADERS, 'Unexpected']
    );

    const error = await validationErrors(input);

    expect(error.issues[0]?.rowNumber).toBe(1);
    expect(error.issues[0]?.message).toContain('Expected columns');
  });

  it('rejects workbooks with more than 200 non-blank data rows', async () => {
    const rows = Array.from(
      { length: MAX_WORKLOG_EXCEL_DATA_ROWS + 1 },
      () => ['2026-11-05 08:00', '2026-11-05 09:00', 'Imported work'] as const
    );
    const input = await workbookBuffer(rows);

    const error = await validationErrors(input);

    expect(error.issues).toEqual([
      {
        rowNumber: 202,
        message: 'A maximum of 200 worklog rows is allowed.',
      },
    ]);
  });

  it('accepts exactly 200 data rows', async () => {
    const rows = Array.from(
      { length: MAX_WORKLOG_EXCEL_DATA_ROWS },
      () => ['2026-11-05 08:00', '2026-11-05 09:00', 'Imported work'] as const
    );
    const input = await workbookBuffer(rows);

    await expect(parseWorklogExcel(input)).resolves.toHaveLength(200);
  });
});
