export const Constants = {
  public: {
    Enums: {
      NotificationType: [
        'assign',
        'status_change',
        'comment',
        'mention',
        'sprint',
        'due_date',
      ],
      RecordStatus: ['active', 'inactive', 'archived', 'deleted'],
      ProjectStatus: ['active', 'archived'],
      SprintStatus: ['planned', 'active', 'closed'],
      UserRole: ['admin', 'manager', 'member'],
      WorkItemPriority: ['lowest', 'low', 'medium', 'high', 'highest'],
      WorkItemStatus: ['Draft', 'New', 'ToDo', 'InProgress', 'Testing', 'Done'],
      WorkItemType: ['Epic', 'Story', 'Task'],
    },
  },
};
