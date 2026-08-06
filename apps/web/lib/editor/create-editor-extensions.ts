import type { AnyExtension } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Emoji, { gitHubEmojis } from '@tiptap/extension-emoji';
import Placeholder from '@tiptap/extension-placeholder';
import { ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { all, createLowlight } from 'lowlight';
import CodeBlockNodeView from '@/app/work-items/_components/workItem-description-editor-nodeView';
import { CustomLinkExtension } from '@/lib/editor/tiptap-link-configuration';

export type EditorExtensionMode = 'compact' | 'full';

export type CreateEditorExtensionsOptions = {
  mode?: EditorExtensionMode;
  /** TipTap Placeholder text; omit to skip the extension. */
  placeholder?: string;
  /** Extra extensions (e.g. comment @/# mentions). */
  extra?: AnyExtension[];
};

const lowlight = createLowlight(all);

const emojiExtension = Emoji.configure({
  emojis: gitHubEmojis,
  enableEmoticons: true,
});

/**
 * Shared TipTap extension set for work-item description and comment editors.
 * - `compact`: modern create + comments (no headings / code / blockquote / hr)
 * - `full`: details description editor (code blocks + default StarterKit blocks)
 */
export function createEditorExtensions(
  options: CreateEditorExtensionsOptions = {}
): AnyExtension[] {
  const mode = options.mode ?? 'compact';
  const isFull = mode === 'full';

  const extensions: AnyExtension[] = [
    StarterKit.configure({
      heading: isFull ? undefined : false,
      codeBlock: false,
      blockquote: isFull ? undefined : false,
      horizontalRule: isFull ? undefined : false,
      link: false,
    }),
    CustomLinkExtension,
    emojiExtension,
  ];

  if (options.placeholder) {
    extensions.push(
      Placeholder.configure({
        placeholder: options.placeholder,
        showOnlyWhenEditable: true,
        // Decorate empty nodes; only `emptyEditorClass` paints the placeholder
        // (whole doc empty). Put ::before utilities on that class so Tailwind
        // keeps working after type → delete / clearContent.
        showOnlyCurrent: false,
        emptyEditorClass:
          'is-editor-empty before:pointer-events-none before:float-left before:h-0 before:text-muted-foreground before:content-[attr(data-placeholder)]',
      })
    );
  }

  if (isFull) {
    extensions.push(
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNodeView);
        },
      })
    );
  }

  if (options.extra?.length) {
    extensions.push(...options.extra);
  }

  return extensions;
}
