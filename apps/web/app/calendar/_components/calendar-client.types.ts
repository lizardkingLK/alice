export type CalendarActionItem = {
  type:
    | 'filter_project'
    | 'filter_assignee'
    | 'filter_type'
    | 'navigate_month'
    | 'view_item_details'
    | 'select_date';
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
