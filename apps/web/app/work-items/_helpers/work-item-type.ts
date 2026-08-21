import type { WorkItemType } from '@repo/types';
import {
  Bookmark,
  CircleAlert,
  Layers,
  Sparkles,
  SquareCheck,
  type LucideIcon,
} from '@repo/ui/lib/icons';

export const WORK_ITEM_TYPE_BADGE_STYLES: Record<WorkItemType, string> = {
  Epic: 'border-work-item-epic/20 bg-work-item-epic/10 text-work-item-epic',
  Story: 'border-work-item-story/20 bg-work-item-story/10 text-work-item-story',
  Task: 'border-work-item-task/20 bg-work-item-task/10 text-work-item-task',
  Issue: 'border-work-item-issue/20 bg-work-item-issue/10 text-work-item-issue',
  Feature:
    'border-work-item-feature/20 bg-work-item-feature/10 text-work-item-feature',
};

export const WORK_ITEM_TYPE_ICONS: Record<WorkItemType, LucideIcon> = {
  Epic: Layers,
  Story: Bookmark,
  Task: SquareCheck,
  Issue: CircleAlert,
  Feature: Sparkles,
};
