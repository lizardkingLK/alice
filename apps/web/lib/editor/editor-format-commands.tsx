'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import EditorCommand from '@/app/work-items/_components/work-item-description/work-item-description-editor-command';
import { toggleListPreservingLines } from '@/lib/editor/toggle-list-preserving-lines';

export type EditorFormatCommandState = {
  isBoldActive: boolean;
  isItalicActive: boolean;
  isUnderlineActive: boolean;
  isLinkActive: boolean;
  isBulletListActive: boolean;
  isOrderedListActive: boolean;
};

type EditorFormatCommandsProps = {
  editor: Editor;
  state: EditorFormatCommandState;
  onOpenLink: () => void;
  /** Icon size classes. Default: size-4. */
  iconClassName?: string;
  bulletListTitle?: string;
  orderedListTitle?: string;
};

/**
 * Shared bold / italic / underline / link / list toolbar buttons.
 */
export function EditorFormatCommands({
  editor,
  state,
  onOpenLink,
  iconClassName = 'size-4',
  bulletListTitle = 'Bullet list',
  orderedListTitle = 'Ordered list',
}: Readonly<EditorFormatCommandsProps>) {
  const iconClass = cn(iconClassName);

  return (
    <>
      <EditorCommand
        title="Bold"
        isActive={state.isBoldActive}
        icon={<Bold className={iconClass} />}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <EditorCommand
        title="Italic"
        isActive={state.isItalicActive}
        icon={<Italic className={iconClass} />}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <EditorCommand
        title="Underline"
        isActive={state.isUnderlineActive}
        icon={<UnderlineIcon className={iconClass} />}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <EditorCommand
        title="Link"
        isActive={state.isLinkActive}
        icon={<Link2 className={iconClass} />}
        onClick={onOpenLink}
      />
      <EditorCommand
        title={bulletListTitle}
        isActive={state.isBulletListActive}
        icon={<List className={iconClass} />}
        onClick={() => toggleListPreservingLines(editor, 'bulletList')}
      />
      <EditorCommand
        title={orderedListTitle}
        isActive={state.isOrderedListActive}
        icon={<ListOrdered className={iconClass} />}
        onClick={() => toggleListPreservingLines(editor, 'orderedList')}
      />
    </>
  );
}
