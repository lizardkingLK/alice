import {
  Bookmark,
  Box,
  Bug,
  Building2,
  Calendar,
  Circle,
  CircleAlert,
  ClipboardList,
  Crown,
  Diamond,
  FileText,
  Flag,
  Folders,
  Gauge,
  Gem,
  Heart,
  Hexagon,
  Layers,
  Lightbulb,
  ListChecks,
  Package,
  Pentagon,
  Puzzle,
  Rocket,
  Shield,
  Sparkles,
  Square,
  SquareCheck,
  Star,
  Target,
  Timer,
  Triangle,
  Trophy,
  Users,
  Wand2,
  Zap,
  type LucideIcon,
} from '@repo/ui/lib/icons';

export type WorkItemTypeIconOption = {
  readonly key: string;
  readonly label: string;
  readonly Icon: LucideIcon;
};

/** Expanded icon set for the catalog icon picker. */
export const WORK_ITEM_TYPE_ICON_OPTIONS: readonly WorkItemTypeIconOption[] = [
  { key: 'layers', label: 'Layers', Icon: Layers },
  { key: 'trophy', label: 'Trophy', Icon: Trophy },
  { key: 'bookmark', label: 'Bookmark', Icon: Bookmark },
  { key: 'square-check', label: 'Check', Icon: SquareCheck },
  { key: 'circle-alert', label: 'Alert', Icon: CircleAlert },
  { key: 'bug', label: 'Bug', Icon: Bug },
  { key: 'zap', label: 'Zap', Icon: Zap },
  { key: 'target', label: 'Target', Icon: Target },
  { key: 'flag', label: 'Flag', Icon: Flag },
  { key: 'star', label: 'Star', Icon: Star },
  { key: 'heart', label: 'Heart', Icon: Heart },
  { key: 'lightbulb', label: 'Idea', Icon: Lightbulb },
  { key: 'rocket', label: 'Rocket', Icon: Rocket },
  { key: 'puzzle', label: 'Puzzle', Icon: Puzzle },
  { key: 'box', label: 'Box', Icon: Box },
  { key: 'package', label: 'Package', Icon: Package },
  { key: 'folders', label: 'Folders', Icon: Folders },
  { key: 'file-text', label: 'File', Icon: FileText },
  { key: 'clipboard-list', label: 'Clipboard', Icon: ClipboardList },
  { key: 'list-checks', label: 'Checklist', Icon: ListChecks },
  { key: 'gauge', label: 'Gauge', Icon: Gauge },
  { key: 'timer', label: 'Timer', Icon: Timer },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'users', label: 'Users', Icon: Users },
  { key: 'building', label: 'Building', Icon: Building2 },
  { key: 'gem', label: 'Gem', Icon: Gem },
  { key: 'crown', label: 'Crown', Icon: Crown },
  { key: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { key: 'wand', label: 'Wand', Icon: Wand2 },
  { key: 'shield', label: 'Shield', Icon: Shield },
  { key: 'hexagon', label: 'Hexagon', Icon: Hexagon },
  { key: 'pentagon', label: 'Pentagon', Icon: Pentagon },
  { key: 'circle', label: 'Circle', Icon: Circle },
  { key: 'square', label: 'Square', Icon: Square },
  { key: 'triangle', label: 'Triangle', Icon: Triangle },
  { key: 'diamond', label: 'Diamond', Icon: Diamond },
] as const;

const ICON_BY_KEY: ReadonlyMap<string, LucideIcon> = new Map(
  WORK_ITEM_TYPE_ICON_OPTIONS.map((option) => [option.key, option.Icon])
);

export function resolveWorkItemTypeIcon(
  iconKey: string | null | undefined
): LucideIcon {
  if (!iconKey) {
    return SquareCheck;
  }
  return ICON_BY_KEY.get(iconKey) ?? SquareCheck;
}
