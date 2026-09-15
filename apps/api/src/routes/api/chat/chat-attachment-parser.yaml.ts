import { type ParsedWorkItemNode } from '@repo/types';
import { transformParsedStructureToNodes } from './chat-attachment-parser.common';
import { parseRawJsonNode } from './chat-attachment-parser.json';

export const YAML_LITERAL_MAP: Readonly<Record<string, unknown>> = {
  true: true,
  false: false,
  null: null,
  '~': null,
};

export function parseYamlScalar(val: string): unknown {
  if (Object.hasOwn(YAML_LITERAL_MAP, val)) {
    return YAML_LITERAL_MAP[val];
  }
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    return val.slice(1, -1);
  }
  return val;
}

export interface YamlParserState {
  lineIdx: number;
}

export function parseYamlListEntry(
  lines: string[],
  state: YamlParserState,
  curIndent: number,
  contentAfterDash: string
): unknown {
  if (contentAfterDash.includes(':') && !contentAfterDash.startsWith('{')) {
    const colonIdx = contentAfterDash.indexOf(':');
    const firstKey = contentAfterDash.slice(0, colonIdx).trim();
    const firstVal = parseYamlScalar(
      contentAfterDash.slice(colonIdx + 1).trim()
    );
    const obj: Record<string, unknown> = { [firstKey]: firstVal };

    const childIndent = curIndent + 2;
    while (state.lineIdx < lines.length) {
      const nextLine = lines[state.lineIdx]!;
      const nextIndent = nextLine.search(/\S/);
      const nextTrimmed = nextLine.trim();

      if (nextIndent < childIndent || nextTrimmed.startsWith('- ')) break;

      const nextColon = nextTrimmed.indexOf(':');
      if (nextColon > 0) {
        const k = nextTrimmed.slice(0, nextColon).trim();
        const vRaw = nextTrimmed.slice(nextColon + 1).trim();
        state.lineIdx++;
        obj[k] =
          vRaw.length === 0
            ? parseYamlBlock(lines, state, nextIndent + 2)
            : parseYamlScalar(vRaw);
      } else {
        state.lineIdx++;
      }
    }
    return obj;
  }
  return parseYamlScalar(contentAfterDash);
}

export function parseYamlList(
  lines: string[],
  state: YamlParserState,
  currentIndent: number
): unknown[] {
  const list: unknown[] = [];
  while (state.lineIdx < lines.length) {
    const curLine = lines[state.lineIdx]!;
    const curIndent = curLine.search(/\S/);
    const curTrimmed = curLine.trim();

    if (curIndent < currentIndent || !curTrimmed.startsWith('- ')) break;

    const contentAfterDash = curTrimmed.slice(2).trim();
    state.lineIdx++;
    list.push(parseYamlListEntry(lines, state, curIndent, contentAfterDash));
  }
  return list;
}

export function parseYamlObject(
  lines: string[],
  state: YamlParserState,
  currentIndent: number
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  while (state.lineIdx < lines.length) {
    const curLine = lines[state.lineIdx]!;
    const curIndent = curLine.search(/\S/);
    const curTrimmed = curLine.trim();

    if (curIndent < currentIndent || curTrimmed.startsWith('- ')) break;

    const colonIdx = curTrimmed.indexOf(':');
    if (colonIdx > 0) {
      const k = curTrimmed.slice(0, colonIdx).trim();
      const vRaw = curTrimmed.slice(colonIdx + 1).trim();
      state.lineIdx++;
      obj[k] =
        vRaw.length === 0
          ? parseYamlBlock(lines, state, curIndent + 2)
          : parseYamlScalar(vRaw);
    } else {
      state.lineIdx++;
    }
  }
  return obj;
}

export function parseYamlBlock(
  lines: string[],
  state: YamlParserState,
  currentIndent: number
): unknown {
  if (state.lineIdx >= lines.length) return null;
  const line = lines[state.lineIdx]!;
  const trimmed = line.trim();
  const indent = line.search(/\S/);

  if (indent < currentIndent) return null;

  if (trimmed.startsWith('- ')) {
    return parseYamlList(lines, state, currentIndent);
  }

  if (trimmed.includes(':')) {
    return parseYamlObject(lines, state, currentIndent);
  }

  return null;
}

export function parseSimpleYaml(content: string): unknown {
  const lines = content
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'));
  if (lines.length === 0) return null;

  const state: YamlParserState = { lineIdx: 0 };
  return parseYamlBlock(lines, state, 0);
}

export function parseYamlWorkItemDocument(
  fileContent: string
): ParsedWorkItemNode[] {
  const parsed = parseSimpleYaml(fileContent);
  return transformParsedStructureToNodes(parsed, 'YAML', parseRawJsonNode);
}
