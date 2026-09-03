import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationInbox } from '@/app/dashboard/_components/dashboard-notifications';
import type { Notification } from '@/app/dashboard/_components/dashboard-notifications';

const mockPush = vi.fn();

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockEq = () => Promise.resolve({ error: null });
const mockUpdate = () => ({ eq: mockEq });
const mockFrom = () => ({ update: mockUpdate });
const mockSubscribe = () => ({});
const mockOn = () => ({ subscribe: mockSubscribe });
const mockChannel = () => ({ on: mockOn });

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: mockChannel,
    removeChannel: vi.fn(),
    from: mockFrom,
  }),
}));

const mockNotification: Notification = {
  id: 'notif-1',
  user_id: 'user-1',
  type: 'comment',
  message:
    'Access request\n\nFrom: requestor@example.com (John Doe)\n\nI need access to the system.',
  read_status: false,
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'system',
  updated_by: 'system',
  related_item_id: null,
};

describe('NotificationInbox access request handling', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens dialog on legacy access request click and redirects to requests tab on Allow', async () => {
    // Arrange
    render(
      <NotificationInbox
        userId="user-1"
        initialNotifications={[mockNotification]}
      />
    );

    // Act - click the notification message
    const notificationBtn = screen.getByRole('button', {
      name: /Access request.*requestor@example.com/i,
    });
    fireEvent.click(notificationBtn);

    // Assert dialog is open
    expect(
      await screen.findByText('Access Request Details')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/An outside domain user is requesting access/i)
    ).toBeInTheDocument();

    // Act - click "Allow" button
    const allowBtn = screen.getByRole('button', { name: /^Allow$/i });
    fireEvent.click(allowBtn);

    // Assert it redirects with the extracted email
    expect(mockPush).toHaveBeenCalledWith(
      '/users?tab=requests&addEmail=requestor%40example.com'
    );
  });
});
