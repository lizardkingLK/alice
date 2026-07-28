import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideo,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

export type AttachmentIconKind =
  | 'archive'
  | 'video'
  | 'spreadsheet'
  | 'json'
  | 'code'
  | 'document'
  | 'image'
  | 'pdf'
  | 'text'
  | 'generic';

const EXT_TO_KIND: Record<string, AttachmentIconKind> = {
  zip: 'archive',
  md: 'text',
  txt: 'text',
  mp4: 'video',
  gif: 'image',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  webp: 'image',
  docx: 'document',
  doc: 'document',
  xlsx: 'spreadsheet',
  xls: 'spreadsheet',
  csv: 'spreadsheet',
  json: 'json',
  html: 'code',
  htm: 'code',
  pdf: 'pdf',
};

const MIME_EXACT_TO_KIND: Record<string, AttachmentIconKind> = {
  'application/pdf': 'pdf',
  'application/json': 'json',
  'text/html': 'code',
  'text/csv': 'spreadsheet',
  'application/zip': 'archive',
  'application/x-zip-compressed': 'archive',
  'application/msword': 'document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'document',
  'application/vnd.ms-excel': 'spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'spreadsheet',
};

/** First matching prefix wins — keep more specific families before `text/`. */
const MIME_PREFIX_TO_KIND: ReadonlyArray<
  readonly [prefix: string, kind: AttachmentIconKind]
> = [
  ['image/', 'image'],
  ['video/', 'video'],
  ['text/', 'text'],
];

const MIME_INCLUDES_TO_KIND: ReadonlyArray<
  readonly [needle: string, kind: AttachmentIconKind]
> = [
  ['zip', 'archive'],
  ['compressed', 'archive'],
  ['spreadsheet', 'spreadsheet'],
  ['excel', 'spreadsheet'],
  ['word', 'document'],
];

const KIND_ICON = {
  archive: FileArchive,
  video: FileVideo,
  spreadsheet: FileSpreadsheet,
  json: FileJson,
  code: FileCode,
  document: FileType,
  image: FileImage,
  pdf: FileText,
  text: FileText,
  generic: File,
} as const;

function extensionOf(fileName: string): string {
  const index = fileName.lastIndexOf('.');
  if (index < 0 || index === fileName.length - 1) {
    return '';
  }
  return fileName.slice(index + 1).toLowerCase();
}

function kindFromMime(mimeType: string): AttachmentIconKind | undefined {
  const exact = MIME_EXACT_TO_KIND[mimeType];
  if (exact) {
    return exact;
  }

  for (const [prefix, kind] of MIME_PREFIX_TO_KIND) {
    if (mimeType.startsWith(prefix)) {
      return kind;
    }
  }

  for (const [needle, kind] of MIME_INCLUDES_TO_KIND) {
    if (mimeType.includes(needle)) {
      return kind;
    }
  }

  return undefined;
}

/** Prefer extension, then MIME — used for card thumbs and non-preview panes. */
export function resolveAttachmentIconKind(
  fileName: string,
  mimeType: string
): AttachmentIconKind {
  return (
    EXT_TO_KIND[extensionOf(fileName)] ?? kindFromMime(mimeType) ?? 'generic'
  );
}

export function isAttachmentPreviewable(mimeType: string): boolean {
  return mimeType.startsWith('image/') || mimeType === 'application/pdf';
}

export function AttachmentFileIcon({
  kind,
  className,
}: Readonly<{
  kind: AttachmentIconKind;
  className?: string;
}>) {
  const Icon = KIND_ICON[kind];
  return <Icon className={cn('text-muted-foreground', className)} />;
}
