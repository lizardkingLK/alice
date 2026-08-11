export type CalendarActionItem = {
  type: 'filter_project' | 'filter_assignee' | 'filter_type' | 'navigate_month' | 'view_item_details';
  entity: {
    id: string;
    value?: string;
    label?: string;
  };
};

export type CalendarStateLog = {
  id: string;
  action: CalendarActionItem;
  timestamp: string;
};

export const CalendarWorkItemTypes = {
  Epic: 'Epic',
  Story: 'Story',
  Task: 'Task',
  Issue: 'Issue',
} as const;

export type CalendarWorkItemType =
  (typeof CalendarWorkItemTypes)[keyof typeof CalendarWorkItemTypes];
