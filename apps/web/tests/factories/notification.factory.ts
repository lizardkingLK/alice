import type { Notification } from '@/app/dashboard/_components/dashboard-notifications';

export const notificationFactory = {
  build(overrides: Partial<Notification> = {}): Notification {
    return {
      id: 'notif-1',
      user_id: 'user-1',
      type: 'comment',
      message: 'A teammate mentioned you',
      read_status: false,
      status: 'active',
      created_at: '2026-09-09T10:00:00.000Z',
      updated_at: '2026-09-09T10:00:00.000Z',
      created_by: 'system',
      updated_by: 'system',
      related_item_id: null,
      ...overrides,
    };
  },

  buildAccessRequest(overrides: Partial<Notification> = {}): Notification {
    return notificationFactory.build({
      type: 'comment',
      message:
        'Access request\n\nFrom: requestor@example.com (John Doe)\n\nI need access to the system.',
      ...overrides,
    });
  },
};
