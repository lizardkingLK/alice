import { mergeAttributes } from '@tiptap/core';
import Mention from '@tiptap/extension-mention';

const MENTION_CLASS =
  'rounded-sm bg-blue-500/10 px-1 py-0.5 font-semibold text-blue-600 dark:text-blue-400';
const WORK_ITEM_MENTION_CLASS =
  'rounded-sm bg-violet-500/10 px-1 py-0.5 font-semibold text-violet-600 dark:text-violet-400';

type MentionAttrs = {
  id?: string | null;
  label?: string | null;
  title?: string | null;
  mentionType?: string | null;
  mentionSuggestionChar?: string | null;
};

function mentionAttrSpecs(defaults: {
  mentionType: 'user' | 'workItem';
  mentionSuggestionChar: '@' | '#';
}) {
  return {
    id: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.dataset.id ?? null,
      renderHTML: (attributes: MentionAttrs) =>
        attributes.id ? { 'data-id': attributes.id } : {},
    },
    label: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.dataset.label ?? null,
      renderHTML: (attributes: MentionAttrs) =>
        attributes.label ? { 'data-label': attributes.label } : {},
    },
    title: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.dataset.title ?? null,
      renderHTML: (attributes: MentionAttrs) =>
        attributes.title ? { 'data-title': attributes.title } : {},
    },
    mentionType: {
      default: defaults.mentionType,
      parseHTML: (element: HTMLElement) =>
        element.dataset.mentionType ?? defaults.mentionType,
      renderHTML: (attributes: MentionAttrs) => ({
        'data-mention-type': attributes.mentionType ?? defaults.mentionType,
      }),
    },
    mentionSuggestionChar: {
      default: defaults.mentionSuggestionChar,
      parseHTML: (element: HTMLElement) =>
        element.dataset.mentionSuggestionChar ?? defaults.mentionSuggestionChar,
      renderHTML: (attributes: MentionAttrs) => ({
        'data-mention-suggestion-char':
          attributes.mentionSuggestionChar ?? defaults.mentionSuggestionChar,
      }),
    },
  };
}

function userMentionText(attrs: MentionAttrs): string {
  return `@${attrs.label || attrs.id || ''}`;
}

function workItemMentionText(attrs: MentionAttrs): string {
  const key = attrs.label || attrs.id || '';
  const title = attrs.title ? ` · ${attrs.title}` : '';
  return `#${key}${title}`;
}

function createTypedMentionExtension(config: {
  name: 'mention' | 'workItemMention';
  className: string;
  mentionType: 'user' | 'workItem';
  mentionSuggestionChar: '@' | '#';
  // eslint-disable-next-line no-unused-vars -- callback signature
  toPlainText: (attrs: MentionAttrs) => string;
}) {
  return Mention.extend({
    name: config.name,
    addProseMirrorPlugins() {
      return [];
    },
    addAttributes() {
      return mentionAttrSpecs({
        mentionType: config.mentionType,
        mentionSuggestionChar: config.mentionSuggestionChar,
      });
    },
  }).configure({
    HTMLAttributes: { class: config.className },
    renderText({ node }) {
      return config.toPlainText(node.attrs as MentionAttrs);
    },
    renderHTML({ options, node }) {
      return [
        'span',
        mergeAttributes({ 'data-type': config.name }, options.HTMLAttributes),
        config.toPlainText(node.attrs as MentionAttrs),
      ];
    },
  });
}

/**
 * Mention node extensions without TipTap Suggestion UI.
 * Autocomplete is handled in CommentEditor via editor text/selection.
 *
 * Attrs are declared explicitly so `label` / `title` survive getJSON → API → render.
 * `renderHTML` must follow Mention's option signature `{ options, node, suggestion }`
 * — not the Node view `{ node, HTMLAttributes }` shape (that caused undefined.nodeType).
 */
export function createCommentMentionExtensions() {
  return [
    createTypedMentionExtension({
      name: 'mention',
      className: MENTION_CLASS,
      mentionType: 'user',
      mentionSuggestionChar: '@',
      toPlainText: userMentionText,
    }),
    createTypedMentionExtension({
      name: 'workItemMention',
      className: WORK_ITEM_MENTION_CLASS,
      mentionType: 'workItem',
      mentionSuggestionChar: '#',
      toPlainText: workItemMentionText,
    }),
  ];
}

export type CommentMentionRef = {
  id: string;
  label: string;
  title?: string | null;
};
