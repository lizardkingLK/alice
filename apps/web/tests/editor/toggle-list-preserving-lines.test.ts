import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { toggleListPreservingLines } from '@/lib/editor/toggle-list-preserving-lines';

function createEditor(content: JSONContent) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  return new Editor({
    element,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
    ],
    content,
  });
}

function listItemTexts(doc: JSONContent): string[] {
  const list = doc.content?.[0];
  if (!list?.content) {
    return [];
  }

  return list.content.flatMap((listItem) => {
    const paragraph = listItem.content?.[0];
    const textNode = paragraph?.content?.[0];
    return textNode?.text ? [textNode.text] : [];
  });
}

describe('toggleListPreservingLines', () => {
  let editor: Editor | undefined;

  afterEach(() => {
    editor?.destroy();
    editor = undefined;
    document.body.replaceChildren();
  });

  beforeEach(() => {
    editor?.destroy();
    editor = undefined;
  });

  it('wraps each paragraph in its own ordered list item', () => {
    editor = createEditor({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'C' }] },
      ],
    });

    const size = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: 1, to: size - 1 });
    toggleListPreservingLines(editor, 'orderedList');

    const json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe('orderedList');
    expect(json.content?.[0]?.content).toHaveLength(3);
    expect(listItemTexts(json)).toEqual(['A', 'B', 'C']);
  });

  it('splits hard breaks into list items', () => {
    editor = createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'A' },
            { type: 'hardBreak' },
            { type: 'text', text: 'B' },
            { type: 'hardBreak' },
            { type: 'text', text: 'C' },
          ],
        },
      ],
    });

    const size = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: 1, to: size - 1 });
    toggleListPreservingLines(editor, 'orderedList');

    const json = editor.getJSON();
    expect(json.content?.[0]?.type).toBe('orderedList');
    expect(json.content?.[0]?.content).toHaveLength(3);
    expect(listItemTexts(json)).toEqual(['A', 'B', 'C']);
  });
});
