/**
 * Work-item description TipTap helpers (barrel).
 * Prefer importing from this path for stable public API.
 */
export {
  fromTiptapContent,
  isTiptapDocument,
  toTiptapContent,
} from '@/app/work-items/_helpers/work-item-description-convert';
export {
  descriptionToHtml,
  nodeToHtml,
} from '@/app/work-items/_helpers/work-item-description-html';
export {
  descriptionToPlainText,
  nodeToPlainText,
} from '@/app/work-items/_helpers/work-item-description-plain-text';
export type {
  TiptapMark,
  TiptapNode,
} from '@/app/work-items/_helpers/work-item-description-types';
