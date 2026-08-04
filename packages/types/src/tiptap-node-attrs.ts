/** Loose TipTap attrs bag shared by comment + description helpers. */
export type TiptapAttrs =
  { readonly [key: string]: unknown } | null | undefined;

export type TiptapLeafNode = {
  type?: string;
  attrs?: TiptapAttrs;
};

export function getAttrString(
  attrs: TiptapAttrs,
  key: string
): string | undefined {
  const value = attrs?.[key];
  return typeof value === 'string' ? value : undefined;
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
