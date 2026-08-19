import { Badge } from '@repo/ui/components/ui/badge';
import { Megaphone } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { formatDate } from '@/app/_shared/utility';
import { PRIORITY_BADGE_STYLES } from '@/app/work-items/_helpers/work-item-priority-ui';

type WorkItemOverdueBadgeProps = {
  readonly dueDate: string;
};

/** Light solid red overdue pill — same palette as Highest priority. */
export function WorkItemOverdueBadge({
  dueDate,
}: Readonly<WorkItemOverdueBadgeProps>) {
  return (
    <Badge
      variant="outline"
      title={formatDate(dueDate)}
      className={cn('gap-1 font-medium', PRIORITY_BADGE_STYLES.highest)}
    >
      <Megaphone className="size-3 shrink-0" aria-hidden />
      Overdue
    </Badge>
  );
}
