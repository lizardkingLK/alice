import ExcelJS, { type Cell, type CellValue } from 'exceljs';

export const WORKLOG_EXCEL_SHEET_NAME = 'Worklogs';
export const WORKLOG_EXCEL_HEADERS = [
  'Start Date/Time',
  'End Date/Time',
  'Description',
] as const;

const INSTRUCTIONS_SHEET_NAME = 'Instructions';
const MAX_LOGGED_HOURS = 1000;
const MAX_DESCRIPTION_LENGTH = 2000;
const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const DATE_TIME_NUMBER_FORMAT = 'yyyy-mm-dd hh:mm';
const DATE_TIME_INPUT_MESSAGE =
  'must be an Excel date/time or text in YYYY-MM-DD HH:mm[:ss] or ISO 8601 format.';

type WorklogExcelField = (typeof WORKLOG_EXCEL_HEADERS)[number];

export type WorklogExcelValidationIssue = {
  rowNumber: number;
  field?: WorklogExcelField;
  message: string;
};

export type ParsedWorklogExcelRow = {
  rowNumber: number;
  startAt: string;
  endAt: string;
  loggedHours: number;
  description: string | null;
};

export class WorklogExcelValidationError extends Error {
  readonly issues: readonly WorklogExcelValidationIssue[];

  constructor(issues: readonly WorklogExcelValidationIssue[]) {
    super(
      issues.length === 1
        ? `Excel validation failed: row ${issues[0]!.rowNumber}: ${issues[0]!.message}`
        : `Excel validation failed with ${issues.length} errors.`
    );
    this.name = 'WorklogExcelValidationError';
    this.issues = issues;
  }
}

function styleTemplateWorklogsSheet(sheet: ExcelJS.Worksheet): void {
  sheet.views = [{ state: 'frozen', ySplit: 1, showGridLines: false }];
  sheet.columns = [
    { key: 'start', width: 23, style: { numFmt: DATE_TIME_NUMBER_FORMAT } },
    { key: 'end', width: 23, style: { numFmt: DATE_TIME_NUMBER_FORMAT } },
    { key: 'description', width: 60 },
  ];

  const header = sheet.getRow(1);
  header.height = 24;
  header.font = {
    name: 'Arial',
    size: 10,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F4E78' },
  };
  header.alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.getColumn(1).alignment = { vertical: 'middle' };
  sheet.getColumn(2).alignment = { vertical: 'middle' };
  sheet.getColumn(3).alignment = { vertical: 'top', wrapText: true };
}

function addInstructionsSheet(workbook: ExcelJS.Workbook): void {
  const sheet = workbook.addWorksheet(INSTRUCTIONS_SHEET_NAME, {
    views: [{ showGridLines: false }],
  });
  sheet.getColumn(1).width = 105;
  sheet.getCell('A2').value = 'Worklog Excel template';
  sheet.getCell('A2').font = { name: 'Arial', size: 14, bold: true };
  sheet.getCell('A4').value =
    'Text date/time format: YYYY-MM-DD HH:mm or YYYY-MM-DD HH:mm:ss. ISO 8601 values are also accepted.';
  sheet.getCell('A5').value =
    'Timezone policy: Excel date/time cells and text without an offset are interpreted as UTC. ISO offsets are converted to UTC.';
  sheet.getCell('A6').value =
    'Overnight entries must put End Date/Time on the next calendar date. End Date/Time must be later than Start Date/Time.';
  sheet.getCell('A7').value =
    'Description is optional and must not exceed 2000 characters. Each duration must be 1000 hours or less.';
  sheet.getCell('A8').value =
    'Keep the Worklogs sheet name and the three column headers unchanged. Fully blank rows are ignored.';
  for (let rowNumber = 4; rowNumber <= 8; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    row.getCell(1).font = { name: 'Arial', size: 10 };
    row.getCell(1).alignment = { vertical: 'top', wrapText: true };
    row.height = 30;
  }
}

/** Creates the Phase 1 workbook template. A future download route can return these bytes unchanged. */
export async function createWorklogExcelTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Alice';
  workbook.subject = 'Worklog upload template';
  workbook.title = 'Worklog upload';

  const sheet = workbook.addWorksheet(WORKLOG_EXCEL_SHEET_NAME);
  sheet.addRow([...WORKLOG_EXCEL_HEADERS]);
  styleTemplateWorklogsSheet(sheet);
  addInstructionsSheet(workbook);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function cellIsBlank(cell: Cell): boolean {
  const value = cell.value;
  return value === null || value === undefined || cell.text.trim() === '';
}

function isFixedDigits(value: string, length: number): boolean {
  return (
    value.length === length &&
    [...value].every((char) => char >= '0' && char <= '9')
  );
}

function splitTimezone(value: string): {
  wallClock: string;
  timezone: string | undefined;
} {
  if (value.endsWith('Z')) {
    return { wallClock: value.slice(0, -1), timezone: 'Z' };
  }
  const candidate = value.slice(-6);
  if (
    (candidate[0] === '+' || candidate[0] === '-') &&
    candidate[3] === ':' &&
    isFixedDigits(candidate.slice(1, 3), 2) &&
    isFixedDigits(candidate.slice(4, 6), 2)
  ) {
    return { wallClock: value.slice(0, -6), timezone: candidate };
  }
  return { wallClock: value, timezone: undefined };
}

function parseDateTimeParts(value: string): number[] | null {
  const separatorIndex = value.includes('T')
    ? value.indexOf('T')
    : value.indexOf(' ');
  if (separatorIndex < 0) {
    return null;
  }

  const dateParts = value.slice(0, separatorIndex).split('-');
  const timeParts = value.slice(separatorIndex + 1).split(':');
  if (
    dateParts.length !== 3 ||
    timeParts.length < 2 ||
    timeParts.length > 3 ||
    !isFixedDigits(dateParts[0] ?? '', 4) ||
    !isFixedDigits(dateParts[1] ?? '', 2) ||
    !isFixedDigits(dateParts[2] ?? '', 2) ||
    !isFixedDigits(timeParts[0] ?? '', 2) ||
    !isFixedDigits(timeParts[1] ?? '', 2)
  ) {
    return null;
  }

  const secondsParts = (timeParts[2] ?? '00').split('.');
  if (
    secondsParts.length > 2 ||
    !isFixedDigits(secondsParts[0] ?? '', 2) ||
    (secondsParts.length === 2 &&
      (!secondsParts[1] ||
        secondsParts[1].length > 3 ||
        !isFixedDigits(secondsParts[1], secondsParts[1].length)))
  ) {
    return null;
  }

  return [
    ...dateParts.map(Number),
    Number(timeParts[0]),
    Number(timeParts[1]),
    Number(secondsParts[0]),
    Number((secondsParts[1] ?? '').padEnd(3, '0')),
  ];
}

function parseDateTimeText(value: string): Date | null {
  const { wallClock, timezone } = splitTimezone(value.trim());
  const parts = parseDateTimeParts(wallClock);
  if (!parts) {
    return null;
  }

  const [year, month, day, hour, minute, second, millisecond] = parts as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ];

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }

  const localUtc = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    millisecond
  );
  const calendarCheck = new Date(localUtc);
  if (
    calendarCheck.getUTCFullYear() !== year ||
    calendarCheck.getUTCMonth() !== month - 1 ||
    calendarCheck.getUTCDate() !== day ||
    calendarCheck.getUTCHours() !== hour ||
    calendarCheck.getUTCMinutes() !== minute ||
    calendarCheck.getUTCSeconds() !== second
  ) {
    return null;
  }

  let offsetMinutes = 0;
  if (timezone && timezone !== 'Z') {
    const sign = timezone[0] === '+' ? 1 : -1;
    const offsetHours = Number(timezone.slice(1, 3));
    const offsetRemainder = Number(timezone.slice(4, 6));
    if (offsetHours > 23 || offsetRemainder > 59) {
      return null;
    }
    offsetMinutes = sign * (offsetHours * 60 + offsetRemainder);
  }

  const date = new Date(localUtc - offsetMinutes * 60 * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateFromCellValue(value: CellValue): Date | null {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  }
  if (typeof value === 'string') {
    return parseDateTimeText(value);
  }
  return null;
}

function requiredDateFromCell(
  cell: Cell,
  rowNumber: number,
  field: WorklogExcelField,
  issues: WorklogExcelValidationIssue[]
): Date | null {
  if (cellIsBlank(cell)) {
    issues.push({ rowNumber, field, message: `${field} is required.` });
    return null;
  }

  const parsed = dateFromCellValue(cell.value);
  if (!parsed) {
    issues.push({
      rowNumber,
      field,
      message: `${field} ${DATE_TIME_INPUT_MESSAGE}`,
    });
  }
  return parsed;
}

function descriptionFromCell(
  cell: Cell,
  rowNumber: number,
  issues: WorklogExcelValidationIssue[]
): string | null {
  if (cellIsBlank(cell)) {
    return null;
  }

  const description = cell.text.trim();
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    issues.push({
      rowNumber,
      field: 'Description',
      message: `Description must not exceed ${MAX_DESCRIPTION_LENGTH} characters.`,
    });
  }
  return description;
}

function headersAreValid(sheet: ExcelJS.Worksheet): boolean {
  return (
    WORKLOG_EXCEL_HEADERS.every(
      (expected, index) => sheet.getCell(1, index + 1).text.trim() === expected
    ) && sheet.getCell(1, WORKLOG_EXCEL_HEADERS.length + 1).text.trim() === ''
  );
}

function rowIsBlank(row: ExcelJS.Row): boolean {
  return [1, 2, 3].every((column) => cellIsBlank(row.getCell(column)));
}

function validateRow(
  row: ExcelJS.Row,
  issues: WorklogExcelValidationIssue[]
): ParsedWorklogExcelRow | null {
  const rowNumber = row.number;
  const startAt = requiredDateFromCell(
    row.getCell(1),
    rowNumber,
    'Start Date/Time',
    issues
  );
  const endAt = requiredDateFromCell(
    row.getCell(2),
    rowNumber,
    'End Date/Time',
    issues
  );
  const description = descriptionFromCell(row.getCell(3), rowNumber, issues);

  if (!startAt || !endAt) {
    return null;
  }

  const durationMilliseconds = endAt.getTime() - startAt.getTime();
  if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
    issues.push({
      rowNumber,
      field: 'End Date/Time',
      message: 'End Date/Time must be later than Start Date/Time.',
    });
    return null;
  }

  const loggedHours = durationMilliseconds / MILLISECONDS_PER_HOUR;
  if (!Number.isFinite(loggedHours) || loggedHours <= 0) {
    issues.push({
      rowNumber,
      field: 'End Date/Time',
      message: 'Duration must be a finite positive number of hours.',
    });
    return null;
  }
  if (loggedHours > MAX_LOGGED_HOURS) {
    issues.push({
      rowNumber,
      field: 'End Date/Time',
      message: `Duration must not exceed ${MAX_LOGGED_HOURS} hours.`,
    });
    return null;
  }

  return {
    rowNumber,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    loggedHours,
    description,
  };
}

/** Parses all rows atomically. Any issue rejects the complete workbook. */
export async function parseWorklogExcel(
  input: Buffer
): Promise<ParsedWorklogExcelRow[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(Uint8Array.from(input).buffer);
  } catch {
    throw new WorklogExcelValidationError([
      { rowNumber: 1, message: 'The file is not a valid .xlsx workbook.' },
    ]);
  }

  const sheet = workbook.getWorksheet(WORKLOG_EXCEL_SHEET_NAME);
  if (!sheet || !headersAreValid(sheet)) {
    throw new WorklogExcelValidationError([
      {
        rowNumber: 1,
        message: `Expected columns: ${WORKLOG_EXCEL_HEADERS.join(', ')}.`,
      },
    ]);
  }

  const issues: WorklogExcelValidationIssue[] = [];
  const rows: ParsedWorklogExcelRow[] = [];
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (rowIsBlank(row)) {
      continue;
    }
    const parsed = validateRow(row, issues);
    if (parsed) {
      rows.push(parsed);
    }
  }

  if (issues.length > 0) {
    throw new WorklogExcelValidationError(issues);
  }
  if (rows.length === 0) {
    throw new WorklogExcelValidationError([
      { rowNumber: 2, message: 'At least one worklog row is required.' },
    ]);
  }
  return rows;
}
