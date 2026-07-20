import { formatLabelFirstLetterCapitalized } from '@/app/_shared/utility';
import { RendererProps } from '@/app/work-items/_components/workItems-table';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { Badge } from '@repo/ui/components/ui/badge';

type WorkItemPriority = DbWorkItem['priority'];

const PRIORITY_VARIANTS: Record<
  WorkItemPriority,
  'secondary' | 'outline' | 'default' | 'destructive'
> = {
  lowest: 'secondary',
  low: 'outline',
  medium: 'default',
  high: 'destructive',
  highest: 'destructive',
};

export const PriorityBadge = ({ priority }: { priority: WorkItemPriority }) => {
  return (
    <Badge variant={PRIORITY_VARIANTS[priority]}>
      {formatLabelFirstLetterCapitalized(priority)}
    </Badge>
  );
};

export default function priorityRenderer({ row }: RendererProps) {
  return <PriorityBadge priority={row.original.priority} />;
}
