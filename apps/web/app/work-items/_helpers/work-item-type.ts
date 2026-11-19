import {
  DEFAULT_WORK_ITEM_TYPE_DEFS,
  WorkItemTypeEnum,
  type ProjectWorkItemTypeDef,
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
import { resolveWorkItemTypeIcon } from '@/app/work-items/_helpers/work-item-type-icons';

type SeedStyleMap = Record<SeedWorkItemTypeKey, string>;
type SeedIconMap = Record<SeedWorkItemTypeKey, LucideIcon>;
type SeedColorMap = Record<SeedWorkItemTypeKey, string>;

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

const FALLBACK_SEED_COLOR = '#64748B';

/** Seed accent colors derived from `@repo/types` catalog defaults (single source). */
export const WORK_ITEM_TYPE_DEFAULT_COLORS: SeedColorMap = Object.fromEntries(
  DEFAULT_WORK_ITEM_TYPE_DEFS.map((def) => [
    def.key,
    def.color ?? FALLBACK_SEED_COLOR,
  ])
) as SeedColorMap;

const DEFAULT_SEED = WorkItemTypeEnum.Task;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function asSeedKey(type: WorkItemType): SeedWorkItemTypeKey {
  if (type in WORK_ITEM_TYPE_ICONS) {
    return type as SeedWorkItemTypeKey;
  }
  return DEFAULT_SEED;
}

type Rgb = { readonly r: number; readonly g: number; readonly b: number };

function parseHexRgb(hex: string): Rgb {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance for an sRGB hex color (`#RRGGBB`). */
export function workItemTypeRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHexRgb(hex);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

function mixRgb(from: Rgb, toward: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return {
    r: Math.round(from.r + (toward.r - from.r) * t),
    g: Math.round(from.g + (toward.g - from.g) * t),
    b: Math.round(from.b + (toward.b - from.b) * t),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Text/icon color for tinted type cards: light accents darken, dark accents
 * lighten, so labels stay readable on the soft tinted background.
 */
export function workItemTypeContrastTextColor(accentHex: string): string {
  if (!isWorkItemTypeHexColor(accentHex)) {
    return FALLBACK_SEED_COLOR;
  }
  const rgb = parseHexRgb(accentHex);
  const luminance = workItemTypeRelativeLuminance(accentHex);

  if (luminance >= 0.62) {
    // Pale / neon accents → pull toward black while keeping hue.
    return rgbToHex(mixRgb(rgb, { r: 0, g: 0, b: 0 }, 0.58));
  }
  if (luminance <= 0.14) {
    // Near-black accents → lift toward white for contrast on tinted cards.
    return rgbToHex(mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.5));
  }
  // Mid-tone accents (typical seed blues/greens) stay as picked.
  return accentHex.toUpperCase();
}

export function isWorkItemTypeHexColor(
  value: string | null | undefined
): boolean {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value);
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

/** Prefer catalog `icon` when present; otherwise fall back to seed-by-key. */
export function workItemTypeIconFromDef(
  def: Pick<ProjectWorkItemTypeDef, 'key' | 'icon'>
): LucideIcon {
  if (def.icon) {
    return resolveWorkItemTypeIcon(def.icon);
  }
  return workItemTypeIcon(def.key);
}

export function workItemTypeColorFromDef(
  def: Pick<ProjectWorkItemTypeDef, 'key' | 'color'>
): string {
  if (isWorkItemTypeHexColor(def.color)) {
    return def.color!;
  }
  return (
    WORK_ITEM_TYPE_DEFAULT_COLORS[asSeedKey(def.key)] ?? FALLBACK_SEED_COLOR
  );
}

/** Inline styles for catalog cards / live previews when a hex color is set. */
export function workItemTypeCardToneStyle(
  def: Pick<ProjectWorkItemTypeDef, 'key' | 'color'>
): { borderColor: string; backgroundColor: string; color: string } {
  const accent = workItemTypeColorFromDef(def);
  return {
    borderColor: hexToRgba(accent, 0.35),
    backgroundColor: hexToRgba(accent, 0.12),
    color: workItemTypeContrastTextColor(accent),
  };
}
