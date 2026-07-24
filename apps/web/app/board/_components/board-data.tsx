import { getWorkItems } from '@/app/work-items/_services/workItem.service.server';
import { KanbanBoard } from '@/app/board/_components/kanban-board';

export async function BoardData() {
  const workItems = await getWorkItems();
  const boardItems = workItems.filter((item) => item.status !== 'Draft');

  return <KanbanBoard initialWorkItems={boardItems} />;
}
