import type { WorkItemType } from '@repo/types';
import {
  Bookmark,
  CircleAlert,
  Layers,
  SquareCheck,
  Trophy,
  type LucideIcon,
} from '@repo/ui/lib/icons';

export const WORK_ITEM_TYPE_BADGE_STYLES: Record<WorkItemType, string> = {
  Epic: 'border-work-item-epic/20 bg-work-item-epic/10 text-work-item-epic',
  Feature:
    'border-work-item-feature/20 bg-work-item-feature/10 text-work-item-feature',
  Story: 'border-work-item-story/20 bg-work-item-story/10 text-work-item-story',
  Task: 'border-work-item-task/20 bg-work-item-task/10 text-work-item-task',
  Issue: 'border-work-item-issue/20 bg-work-item-issue/10 text-work-item-issue',
};

/** Soft gradient start for the details summary banner (type color mode). */
export const WORK_ITEM_TYPE_TINT: Record<WorkItemType, string> = {
  Epic: 'from-work-item-epic/5',
  Feature: 'from-work-item-feature/5',
  Story: 'from-work-item-story/5',
  Task: 'from-work-item-task/5',
  Issue: 'from-work-item-issue/5',
};

export const WORK_ITEM_TYPE_BORDER: Record<WorkItemType, string> = {
  Epic: 'border-work-item-epic/20',
  Feature: 'border-work-item-feature/20',
  Story: 'border-work-item-story/20',
  Task: 'border-work-item-task/20',
  Issue: 'border-work-item-issue/20',
};

export const WORK_ITEM_TYPE_TEXT: Record<WorkItemType, string> = {
  Epic: 'text-work-item-epic',
  Feature: 'text-work-item-feature',
  Story: 'text-work-item-story',
  Task: 'text-work-item-task',
  Issue: 'text-work-item-issue',
};

export const WORK_ITEM_TYPE_ICONS: Record<WorkItemType, LucideIcon> = {
  Epic: Layers,
  Feature: Trophy,
  Story: Bookmark,
  Task: SquareCheck,
  Issue: CircleAlert,
};
