import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';

export type BurndownScopeLabelsProps = {
  readonly projectName: string | null;
  readonly sprintName: string | null;
  readonly className?: string;
};

/**
 * Compact Project · Sprint context for chart / burndown widgets (dashboard
 * overview and Charts). Prefer placing in the card header top-right.
 */
export function BurndownScopeLabels({
  projectName,
  sprintName,
  className,
}: BurndownScopeLabelsProps) {
  const project = projectName?.trim() || null;
  const sprint = sprintName?.trim() || null;

  if (!project && !sprint) {
    return null;
  }

  const ariaLabel = ['Widget scope', project, sprint]
    .filter(Boolean)
    .join(': ');

  return (
    <fieldset
      aria-label={ariaLabel}
      className={cn(
        'm-0 flex max-w-[min(100%,16rem)] min-w-0 items-center justify-end gap-1.5 border-0 p-0',
        className
      )}
    >
      {project ? (
        <TruncatedText className="text-muted-foreground text-xs font-medium">
          {project}
        </TruncatedText>
      ) : null}
      {project && sprint ? (
        <span className="text-muted-foreground/50 shrink-0 text-xs" aria-hidden>
          ·
        </span>
      ) : null}
      {sprint ? (
        <TruncatedText className="text-muted-foreground text-xs">
          {sprint}
        </TruncatedText>
      ) : null}
    </fieldset>
  );
}
