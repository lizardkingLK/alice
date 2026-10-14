import {
  type ParsedWorkItemNode,
  ChatAttachmentFileTypeEnum,
} from '@repo/types';
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

const MAX_ATTACHMENT_DOWNLOAD_BYTES = 10 * 1024 * 1024;
const ATTACHMENT_DOWNLOAD_TIMEOUT_MS = 10_000;

class SafeAttachmentDownloadError extends Error {}

function assertApprovedAttachmentUrl(
  attachmentUrl: string,
  approvedOrigin: string
): URL {
  let parsedUrl: URL;
  let normalizedApprovedOrigin: string;
  try {
    parsedUrl = new URL(attachmentUrl);
    normalizedApprovedOrigin = new URL(approvedOrigin).origin;
  } catch {
    throw new SafeAttachmentDownloadError('Attachment URL is invalid.');
  }

  if (
    parsedUrl.origin !== normalizedApprovedOrigin ||
    parsedUrl.username.length > 0 ||
    parsedUrl.password.length > 0
  ) {
    throw new SafeAttachmentDownloadError('Attachment URL is not approved.');
  }

  return parsedUrl;
}

async function readResponseTextWithLimit(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_ATTACHMENT_DOWNLOAD_BYTES
  ) {
    throw new SafeAttachmentDownloadError('Attachment is too large to parse.');
  }

  if (!response.body) {
    const content = await response.text();
    if (Buffer.byteLength(content, 'utf8') > MAX_ATTACHMENT_DOWNLOAD_BYTES) {
      throw new SafeAttachmentDownloadError(
        'Attachment is too large to parse.'
      );
    }
    return content;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_ATTACHMENT_DOWNLOAD_BYTES) {
      await reader.cancel();
      throw new SafeAttachmentDownloadError(
        'Attachment is too large to parse.'
      );
    }
    content += decoder.decode(value, { stream: true });
  }

  return content + decoder.decode();
}

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
  fileType: ChatAttachmentFileTypeEnum,
  approvedOrigin: string
): Promise<{
  items: ParsedWorkItemNode[];
  summary: string;
}> {
  let textContent = '';
  const approvedUrl = assertApprovedAttachmentUrl(
    attachmentUrl,
    approvedOrigin
  );
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ATTACHMENT_DOWNLOAD_TIMEOUT_MS
  );
  try {
    const response = await fetch(approvedUrl, {
      redirect: 'error',
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      throw new SafeAttachmentDownloadError(
        'Attachment redirects are not allowed.'
      );
    }
    if (!response.ok) {
      throw new SafeAttachmentDownloadError('Could not access attachment.');
    }
    textContent = await readResponseTextWithLimit(response);
  } catch (error: unknown) {
    console.error('Failed to download an approved chat attachment.');
    if (error instanceof SafeAttachmentDownloadError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new SafeAttachmentDownloadError('Attachment download timed out.');
    }
    throw new SafeAttachmentDownloadError('Could not access attachment.');
  } finally {
    clearTimeout(timeout);
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
