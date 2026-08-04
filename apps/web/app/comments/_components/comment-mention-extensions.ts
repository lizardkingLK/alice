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
      parseHTML: (element: HTMLElement) => element.getAttribute('data-id'),
      renderHTML: (attributes: MentionAttrs) =>
        attributes.id ? { 'data-id': attributes.id } : {},
    },
    label: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.getAttribute('data-label'),
      renderHTML: (attributes: MentionAttrs) =>
        attributes.label ? { 'data-label': attributes.label } : {},
    },
    title: {
      default: null as string | null,
      parseHTML: (element: HTMLElement) => element.getAttribute('data-title'),
      renderHTML: (attributes: MentionAttrs) =>
        attributes.title ? { 'data-title': attributes.title } : {},
    },
    mentionType: {
      default: defaults.mentionType,
      parseHTML: (element: HTMLElement) =>
        element.getAttribute('data-mention-type') ?? defaults.mentionType,
      renderHTML: (attributes: MentionAttrs) => ({
        'data-mention-type': attributes.mentionType ?? defaults.mentionType,
      }),
    },
    mentionSuggestionChar: {
      default: defaults.mentionSuggestionChar,
      parseHTML: (element: HTMLElement) =>
        element.getAttribute('data-mention-suggestion-char') ??
        defaults.mentionSuggestionChar,
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

/**
 * Mention node extensions without TipTap Suggestion UI.
 * Autocomplete is handled in CommentEditor via editor text/selection.
 *
 * Attrs are declared explicitly so `label` / `title` survive getJSON → API → render.
 * `renderHTML` must follow Mention's option signature `{ options, node, suggestion }`
 * — not the Node view `{ node, HTMLAttributes }` shape (that caused undefined.nodeType).
 */
export function createCommentMentionExtensions() {
  const UserMention = Mention.extend({
    name: 'mention',
    addProseMirrorPlugins() {
      return [];
    },
    addAttributes() {
      return mentionAttrSpecs({
        mentionType: 'user',
        mentionSuggestionChar: '@',
      });
    },
  }).configure({
    HTMLAttributes: { class: MENTION_CLASS },
    renderText({ node }) {
      return userMentionText(node.attrs as MentionAttrs);
    },
    renderHTML({ options, node }) {
      return [
        'span',
        mergeAttributes({ 'data-type': 'mention' }, options.HTMLAttributes),
        userMentionText(node.attrs as MentionAttrs),
      ];
    },
  });

  const WorkItemMention = Mention.extend({
    name: 'workItemMention',
    addProseMirrorPlugins() {
      return [];
    },
    addAttributes() {
      return mentionAttrSpecs({
        mentionType: 'workItem',
        mentionSuggestionChar: '#',
      });
    },
  }).configure({
    HTMLAttributes: { class: WORK_ITEM_MENTION_CLASS },
    renderText({ node }) {
      return workItemMentionText(node.attrs as MentionAttrs);
    },
    renderHTML({ options, node }) {
      return [
        'span',
        mergeAttributes(
          { 'data-type': 'workItemMention' },
          options.HTMLAttributes
        ),
        workItemMentionText(node.attrs as MentionAttrs),
      ];
    },
  });

  return [UserMention, WorkItemMention];
}

export type CommentMentionRef = {
  id: string;
  label: string;
  title?: string | null;
};
