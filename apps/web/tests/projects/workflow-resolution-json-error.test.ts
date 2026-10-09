import { describe, expect, it } from 'vitest';
import {
  offsetToLineColumn,
  resolveJsonErrorLocation,
  toJsonEditorError,
} from '@/app/projects/_helpers/workflow-resolution-json-error';

function parseErrorMessage(text: string): string {
  try {
    JSON.parse(text);
    throw new Error('expected JSON.parse to fail');
  } catch (error) {
    if (
      error instanceof Error &&
      error.message !== 'expected JSON.parse to fail'
    ) {
      return error.message;
    }
    throw error;
  }
}

describe('workflow-resolution-json-error', () => {
  it('points at the bare object key when a stray ] follows (missing array bracket)', () => {
    const text = `{
  "id": "preset-1",
  "title": "Demo",
  "fields": [],
  "outcomes":
  {
    "id": "outcome-1",
    "label": "Fixed"
  },
]}`;

    const rawMessage = parseErrorMessage(text);
    const location = resolveJsonErrorLocation(text, rawMessage);
    expect(location.line).toBe(5);
    expect(location.column).toBe(
      offsetToLineColumn(
        text,
        text.indexOf('"outcomes":') + '"outcomes":'.length
      ).column
    );
    expect(toJsonEditorError(text, new Error(rawMessage)).message).toBe(
      `Invalid JSON at Ln ${location.line}, Col ${location.column}`
    );
  });

  it('points at outcomes colon when a second object follows a bare object (missing [)', () => {
    const text = `{
  "id": "preset-1",
  "title": "Demo",
  "fields": [],
  "outcomes":
    {
      "id": "outcome-1",
      "label": "Fixed"
    },
    {
      "id": "outcome-2",
      "label": "Won't Fix"
    },
    {
      "id": "outcome-3",
      "label": "Questions"
    }
  ]
}`;

    const rawMessage = parseErrorMessage(text);
    const location = resolveJsonErrorLocation(text, rawMessage);
    const outcomesColon = text.indexOf('"outcomes":') + '"outcomes":'.length;
    expect(location).toEqual(offsetToLineColumn(text, outcomesColon));
    expect(location.line).toBe(5);
  });

  it('formats errors as Ln/Col only', () => {
    const text = '{"title":}';
    const rawMessage = parseErrorMessage(text);
    expect(toJsonEditorError(text, new Error(rawMessage)).message).toMatch(
      /^Invalid JSON at Ln \d+, Col \d+$/
    );
  });

  it('locates Unexpected token without a byte position (no false Ln 1 Col 1)', () => {
    const text = `{
  "id": "preset-1",
  "title": "Demo",
  "fields": [],
  "outcomes": sdfsdf
  {
    "id": "outcome-1",
    "label": "Fixed"
  }
}`;

    const rawMessage = parseErrorMessage(text);
    expect(rawMessage).toMatch(/^Unexpected token/);
    expect(rawMessage).not.toMatch(/at position/);

    const location = resolveJsonErrorLocation(text, rawMessage);
    expect(location.line).toBe(5);
    expect(location.column).toBe(
      offsetToLineColumn(text, text.indexOf('sdfsdf')).column
    );
    expect(location).not.toEqual({ line: 1, column: 1 });
  });
});
