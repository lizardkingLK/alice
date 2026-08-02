import type { ComponentProps, SVGProps } from 'react';
import {
  Circle,
  CircleDashed,
  CircleDot,
  FlaskConical,
  type LucideIcon,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { WorkItemStatus } from '@repo/types';

type StatusIconProps = SVGProps<SVGSVGElement> & {
  readonly className?: string;
};

/**
 * Linear / ClickUp-style half-filled status (stroke ring + filled semicircle).
 * Lucide has no matching glyph.
 */
export function StatusInProgressIcon({ className, ...props }: StatusIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('size-3 shrink-0', className)}
      {...props}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 2a6 6 0 0 1 0 12V2Z" fill="currentColor" />
    </svg>
  );
}

/** Solid filled circle with a white check (inherits green from badge text color). */
export function StatusDoneIcon({ className, ...props }: StatusIconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className={cn('size-3 shrink-0', className)}
      {...props}
    >
      <circle cx="8" cy="8" r="7" fill="currentColor" />
      <path
        d="M4.75 8.25 6.9 10.4 11.25 5.6"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type WorkItemStatusIcon =
  LucideIcon | typeof StatusInProgressIcon | typeof StatusDoneIcon;

export const WORK_ITEM_STATUS_ICONS: Record<
  WorkItemStatus,
  WorkItemStatusIcon
> = {
  Draft: CircleDashed,
  New: CircleDot,
  ToDo: Circle,
  InProgress: StatusInProgressIcon,
  Testing: FlaskConical,
  Done: StatusDoneIcon,
};

export type WorkItemStatusIconProps = ComponentProps<WorkItemStatusIcon>;
