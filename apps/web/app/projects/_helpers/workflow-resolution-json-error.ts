export type JsonCursor = { readonly line: number; readonly column: number };

export type JsonEditorError = JsonCursor & {
  readonly message: string;
};

export function offsetToLineColumn(text: string, offset: number): JsonCursor {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const before = text.slice(0, safeOffset);
  const lines = before.split('\n');
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function braceDepthDelta(character: string): number {
  if (character === '{' || character === '[') {
    return 1;
  }
  if (character === '}' || character === ']') {
    return -1;
  }
  return 0;
}

/** True when only optional trailing comma remains after a closed value. */
function closesWithOptionalComma(trailing: string): boolean {
  const trimmed = trailing.trim();
  return trimmed === '' || trimmed === ',';
}

/**
 * If `match` opens `"key": {` and that object closes with only `,` left before
 * the end of `before`, return the offset just after the colon.
 */
function colonOffsetForCleanObjectClose(
  before: string,
  match: RegExpMatchArray
): number | null {
  const keyColon = match[1];
  const gap = match[2];
  if (match.index == null || !keyColon || gap == null) {
    return null;
  }

  const braceIndex = match.index + keyColon.length + gap.length;
  let depth = 0;
  for (let cursor = braceIndex; cursor < before.length; cursor += 1) {
    depth += braceDepthDelta(before[cursor] ?? '');
    if (depth !== 0) {
      continue;
    }
    if (closesWithOptionalComma(before.slice(cursor + 1))) {
      return match.index + keyColon.length;
    }
    return null;
  }
  return null;
}

/**
 * Prefer the `"key":` that opened a bare object when the next token is a stray
 * `]` or a second `{` (common when `[` was omitted after e.g. `"outcomes":`).
 * Only use when the engine reported a byte position.
 */
export function bareObjectKeyColonOffset(before: string): number | null {
  const matches = [...before.matchAll(/("[^"]+"\s*:)(\s*)(\{)/g)];
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    if (!match) {
      continue;
    }
    const offset = colonOffsetForCleanObjectClose(before, match);
    if (offset != null) {
      return offset;
    }
  }
  return null;
}

function looksLikeMissingArrayAfterBareObject(
  text: string,
  position: number
): boolean {
  const fromPosition = text.slice(position);
  return (
    text[position] === ']' ||
    text[position] === '{' ||
    /^\s*]/.test(fromPosition) ||
    /^\s*\{/.test(fromPosition)
  );
}

/** V8: `Unexpected token 's', ..."utcomes": sdfsdf\n  {"... is not valid JSON` */
function locationFromUnexpectedToken(
  text: string,
  rawMessage: string
): JsonCursor | null {
  const match = rawMessage.match(
    /^Unexpected token '(.)', (?:\.\.\.)?"([\s\S]*?)"(?:\.\.\.)? is not valid JSON$/
  );
  if (!match?.[1] || match[2] == null) {
    return null;
  }

  const token = match[1];
  const snippet = match[2];
  const snippetIndex = text.indexOf(snippet);
  if (snippetIndex < 0) {
    return null;
  }

  const colonWhitespace = snippet.match(/:\s*/);
  let tokenOffsetInSnippet = -1;
  if (colonWhitespace?.index != null) {
    const valueStart = colonWhitespace.index + colonWhitespace[0].length;
    if (snippet[valueStart] === token) {
      tokenOffsetInSnippet = valueStart;
    }
  }
  if (tokenOffsetInSnippet < 0) {
    tokenOffsetInSnippet = snippet.indexOf(token);
  }
  if (tokenOffsetInSnippet < 0) {
    return null;
  }

  return offsetToLineColumn(text, snippetIndex + tokenOffsetInSnippet);
}

/**
 * Map engine messages to Ln/Col.
 * - Prefer byte `position` when present; only then optionally rewind missing-`[`.
 * - Else parse `Unexpected token` snippets (no position in modern V8).
 * - Never invent Ln 1, Col 1 when we can locate the token.
 */
export function resolveJsonErrorLocation(
  text: string,
  rawMessage: string
): JsonCursor {
  const positionMatch = rawMessage.match(/at position\s+(\d+)/i);
  const position =
    positionMatch?.[1] != null
      ? Number.parseInt(positionMatch[1], 10)
      : Number.NaN;

  if (!Number.isNaN(position)) {
    // Rewind only with a real engine offset (missing `[` after `"key": {…},`).
    if (looksLikeMissingArrayAfterBareObject(text, position)) {
      const colonOffset = bareObjectKeyColonOffset(text.slice(0, position));
      if (colonOffset != null) {
        return offsetToLineColumn(text, colonOffset);
      }
    }
    return offsetToLineColumn(text, position);
  }

  const fromUnexpected = locationFromUnexpectedToken(text, rawMessage);
  if (fromUnexpected) {
    return fromUnexpected;
  }

  const lineCol = rawMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineCol?.[1] && lineCol[2]) {
    return {
      line: Number.parseInt(lineCol[1], 10),
      column: Number.parseInt(lineCol[2], 10),
    };
  }

  return { line: 1, column: 1 };
}

export function toJsonEditorError(
  text: string,
  error: unknown
): JsonEditorError {
  const rawMessage = error instanceof Error ? error.message : 'Invalid JSON';
  const location = resolveJsonErrorLocation(text, rawMessage);
  return {
    message: `Invalid JSON at Ln ${location.line}, Col ${location.column}`,
    line: location.line,
    column: location.column,
  };
}
