/** Loose TipTap attrs bag shared by comment + description helpers. */
export type TiptapAttrs = { readonly [key: string]: unknown } | null;

export type TiptapLeafNode = {
  type?: string;
  attrs?: TiptapAttrs;
};

export type NormalizedMentionAttrs = {
  id: string;
  label: string;
  title?: string;
  mentionType: 'user' | 'workItem';
  mentionSuggestionChar: '@' | '#';
};

export type NormalizedMentionNode = {
  type: 'mention' | 'workItemMention';
  attrs: NormalizedMentionAttrs;
};

export function getAttrString(
  attrs: TiptapAttrs | undefined,
  key: string
): string | undefined {
  const value = attrs?.[key];
  return typeof value === 'string' ? value : undefined;
}

function nonEmptyAttrString(
  attrs: TiptapAttrs | undefined,
  key: string
): string | undefined {
  const value = getAttrString(attrs, key)?.trim();
  return value && value.length > 0 ? value : undefined;
}

/**
 * Force mention attrs to plain strings so JSONB / server-action round-trips
 * keep id, label, and title (shared by serialize + comment content normalize).
 */
export function normalizeMentionNode(node: {
  type?: string;
  attrs?: TiptapAttrs;
}): NormalizedMentionNode {
  const attrs = node.attrs ?? null;
  const id = nonEmptyAttrString(attrs, 'id') ?? '';
  const label = nonEmptyAttrString(attrs, 'label') ?? id;
  const title = nonEmptyAttrString(attrs, 'title');
  const isWorkItem =
    node.type === 'workItemMention' ||
    nonEmptyAttrString(attrs, 'mentionType') === 'workItem';

  return {
    type: isWorkItem ? 'workItemMention' : 'mention',
    attrs: {
      id,
      label,
      ...(title ? { title } : {}),
      mentionType: isWorkItem ? 'workItem' : 'user',
      mentionSuggestionChar: isWorkItem ? '#' : '@',
    },
  };
}

export function emojiPlainText(node: TiptapLeafNode): string {
  const emoji = getAttrString(node.attrs, 'emoji');
  if (emoji) {
    return emoji;
  }
  const name = getAttrString(node.attrs, 'name');
  return name ? `:${name}:` : '';
}

export function mentionPlainText(node: TiptapLeafNode): string {
  const label = getAttrString(node.attrs, 'label');
  const mentionType = getAttrString(node.attrs, 'mentionType');
  if (node.type === 'workItemMention' || mentionType === 'workItem') {
    return label ? `#${label}` : '#';
  }
  return label ? `@${label}` : '@';
}
