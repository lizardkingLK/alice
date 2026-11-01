import {
  WorkItemTypeEnum,
  type SeedWorkItemTypeKey,
  type WorkItemType,
} from '@repo/types';
import {
  Bookmark,
  CircleAlert,
  Layers,
  SquareCheck,
  Trophy,
  type LucideIcon,
} from '@repo/ui/lib/icons';

type SeedStyleMap = Record<SeedWorkItemTypeKey, string>;
type SeedIconMap = Record<SeedWorkItemTypeKey, LucideIcon>;

export const WORK_ITEM_TYPE_BADGE_STYLES: SeedStyleMap = {
  Epic: 'border-work-item-epic/20 bg-work-item-epic/10 text-work-item-epic',
  Feature:
    'border-work-item-feature/20 bg-work-item-feature/10 text-work-item-feature',
  Story: 'border-work-item-story/20 bg-work-item-story/10 text-work-item-story',
  Task: 'border-work-item-task/20 bg-work-item-task/10 text-work-item-task',
  Issue: 'border-work-item-issue/20 bg-work-item-issue/10 text-work-item-issue',
};

/** Soft gradient start for the details summary banner (type color mode). */
export const WORK_ITEM_TYPE_TINT: SeedStyleMap = {
  Epic: 'from-work-item-epic/5',
  Feature: 'from-work-item-feature/5',
  Story: 'from-work-item-story/5',
  Task: 'from-work-item-task/5',
  Issue: 'from-work-item-issue/5',
};

export const WORK_ITEM_TYPE_BORDER: SeedStyleMap = {
  Epic: 'border-work-item-epic/20',
  Feature: 'border-work-item-feature/20',
  Story: 'border-work-item-story/20',
  Task: 'border-work-item-task/20',
  Issue: 'border-work-item-issue/20',
};

export const WORK_ITEM_TYPE_TEXT: SeedStyleMap = {
  Epic: 'text-work-item-epic',
  Feature: 'text-work-item-feature',
  Story: 'text-work-item-story',
  Task: 'text-work-item-task',
  Issue: 'text-work-item-issue',
};

export const WORK_ITEM_TYPE_ICONS: SeedIconMap = {
  Epic: Layers,
  Feature: Trophy,
  Story: Bookmark,
  Task: SquareCheck,
  Issue: CircleAlert,
};

const DEFAULT_SEED = WorkItemTypeEnum.Task;

function asSeedKey(type: WorkItemType): SeedWorkItemTypeKey {
  if (type in WORK_ITEM_TYPE_ICONS) {
    return type as SeedWorkItemTypeKey;
  }
  return DEFAULT_SEED;
}

export function workItemTypeBadgeStyle(type: WorkItemType): string {
  return WORK_ITEM_TYPE_BADGE_STYLES[asSeedKey(type)];
}

export function workItemTypeTint(type: WorkItemType): string {
  return WORK_ITEM_TYPE_TINT[asSeedKey(type)];
}

export function workItemTypeBorder(type: WorkItemType): string {
  return WORK_ITEM_TYPE_BORDER[asSeedKey(type)];
}

export function workItemTypeText(type: WorkItemType): string {
  return WORK_ITEM_TYPE_TEXT[asSeedKey(type)];
}

export function workItemTypeIcon(type: WorkItemType): LucideIcon {
  return WORK_ITEM_TYPE_ICONS[asSeedKey(type)];
}
