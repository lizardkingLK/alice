import {
  type ParsedWorkItemNode,
  ChatAttachmentFileTypeEnum,
} from '@repo/types';
import { sanitizeLog } from './chat.utils';
import { parseJsonWorkItemDocument } from './chat-attachment-parser.json';
import { parseDelimitedWorkItemDocument } from './chat-attachment-parser.delimited';
import {
  isMarkdownTable,
  parseMarkdownTableWorkItemDocument,
  isIndentedOutline,
  parseIndentedTextWorkItemDocument,
} from './chat-attachment-parser.text';
import { parseYamlWorkItemDocument } from './chat-attachment-parser.yaml';

export {
  parseJsonWorkItemDocument,
  parseRawJsonNode,
} from './chat-attachment-parser.json';
export {
  parseDelimitedWorkItemDocument,
  parseCsvWorkItemDocument,
  detectDelimiter,
} from './chat-attachment-parser.delimited';
export {
  parseMarkdownTableWorkItemDocument,
  parseIndentedTextWorkItemDocument,
} from './chat-attachment-parser.text';
export { parseYamlWorkItemDocument } from './chat-attachment-parser.yaml';

export type AttachmentParser = (content: string) => ParsedWorkItemNode[];

export interface AttachmentParserEntry {
  readonly name: string;
  readonly matches: (
    fileName: string,
    fileType: ChatAttachmentFileTypeEnum,
    content: string
  ) => boolean;
  readonly parse: AttachmentParser;
}

export const PARSER_REGISTRY: readonly AttachmentParserEntry[] = [
  {
    name: 'json',
    matches: (name, type) =>
      type === ChatAttachmentFileTypeEnum.Json || name.endsWith('.json'),
    parse: parseJsonWorkItemDocument,
  },
  {
    name: 'yaml',
    matches: (name) => name.endsWith('.yaml') || name.endsWith('.yml'),
    parse: parseYamlWorkItemDocument,
  },
  {
    name: 'csv',
    matches: (name, type) =>
      type === ChatAttachmentFileTypeEnum.Csv ||
      name.endsWith('.csv') ||
      name.endsWith('.tsv'),
    parse: parseDelimitedWorkItemDocument,
  },
  {
    name: 'markdown_table',
    matches: (_name, _type, content) => isMarkdownTable(content),
    parse: parseMarkdownTableWorkItemDocument,
  },
  {
    name: 'indented_outline',
    matches: (_name, _type, content) => isIndentedOutline(content),
    parse: parseIndentedTextWorkItemDocument,
  },
];

export function tryFallbackParsers(content: string): ParsedWorkItemNode[] {
  try {
    return parseJsonWorkItemDocument(content);
  } catch {
    return parseDelimitedWorkItemDocument(content);
  }
}

export function parseAttachmentContent(
  textContent: string,
  fileName: string,
  fileType: ChatAttachmentFileTypeEnum
): ParsedWorkItemNode[] {
  const lowerName = fileName.toLowerCase();

  const matchedEntry = PARSER_REGISTRY.find((entry) =>
    entry.matches(lowerName, fileType, textContent)
  );

  if (matchedEntry) {
    return matchedEntry.parse(textContent);
  }

  return tryFallbackParsers(textContent);
}

export async function fetchAndParseWorkItemAttachment(
  attachmentUrl: string,
  fileName: string,
  fileType: ChatAttachmentFileTypeEnum
): Promise<{
  items: ParsedWorkItemNode[];
  summary: string;
}> {
  let textContent = '';
  try {
    const response = await fetch(attachmentUrl);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }
    textContent = await response.text();
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to download attachment from URL ${sanitizeLog(attachmentUrl)}:`,
      sanitizeLog(errorMsg)
    );
    throw new Error(`Could not access attachment: ${errorMsg}`);
  }

  const parsedItems = parseAttachmentContent(textContent, fileName, fileType);

  let totalChildCount = 0;
  let dynamicFieldsCount = 0;
  for (const item of parsedItems) {
    if (item.children?.length) {
      totalChildCount += item.children.length;
    }
    if (item.dynamicFields) {
      dynamicFieldsCount += Object.keys(item.dynamicFields).length;
    }
  }

  const summary = `Successfully parsed "${fileName}": Found ${parsedItems.length} root work items, ${totalChildCount} subtasks/children, and ${dynamicFieldsCount} dynamic custom fields.`;

  return { items: parsedItems, summary };
}
