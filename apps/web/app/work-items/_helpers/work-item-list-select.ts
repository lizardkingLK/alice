import { userRelationSelect } from '@repo/types';

export const ASSIGNEE_SELECT = userRelationSelect('assignee', 'assignee_id');
export const REPORTER_SELECT = userRelationSelect('reporter', 'reporter_id');

/** List/board columns — omit TipTap `description` unless a surface previews it. */
export const WORK_ITEM_LIST_COLUMNS =
  'id, project_id, sprint_id, parent_id, title, type, priority, labels, assignee_id, reporter_id, due_date, story_points, status, record_status, done_at, created_by, created_at, updated_by, updated_at, jira_issue_key';

export function workItemListSelect(includeDescription: boolean): string {
  const columns = includeDescription
    ? `${WORK_ITEM_LIST_COLUMNS}, description`
    : WORK_ITEM_LIST_COLUMNS;
  return `${columns}, ${ASSIGNEE_SELECT}, ${REPORTER_SELECT}`;
}
