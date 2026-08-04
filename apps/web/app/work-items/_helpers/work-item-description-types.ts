export type TiptapMark = {
  type?: string;
  attrs?: Record<string, unknown>;
};

export type TiptapNode = {
  type?: string;
  text?: string;
  content?: TiptapNode[];
  marks?: TiptapMark[];
  attrs?: Record<string, unknown>;
};

export const EMPTY_DESCRIPTION = 'No description provided.';

export { getAttrString, emojiPlainText, mentionPlainText } from '@repo/types';

export function getAttrNumber(
  attrs: Record<string, unknown> | undefined,
  key: string
): number | undefined {
  const value = attrs?.[key];
  return typeof value === 'number' ? value : undefined;
}
