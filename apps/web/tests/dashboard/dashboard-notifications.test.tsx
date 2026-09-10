import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { NotificationInbox } from '@/app/dashboard/_components/dashboard-notifications';
import { notificationFactory } from '../factories/notification.factory';

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

const { inboxResult } = vi.hoisted(() => ({
  inboxResult: {
    data: null as unknown[] | null,
    error: null as { message: string } | null,
  },
}));

const mockSubscribe = () => ({});
const mockOn = () => ({ subscribe: mockSubscribe });
const mockChannel = () => ({ on: mockOn });

function createQuery() {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => Promise.resolve(inboxResult)),
    update: vi.fn(() => query),
    then: ((onFulfilled, onRejected) =>
      Promise.resolve(inboxResult).then(onFulfilled, onRejected)) as Promise<
      typeof inboxResult
    >['then'],
  };
  return query;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: mockChannel,
    removeChannel: vi.fn(),
    from: () => createQuery(),
  }),
}));

describe('NotificationInbox access request handling', () => {
  afterEach(() => {
    inboxResult.data = null;
    inboxResult.error = null;
  });

  it('opens dialog on legacy access request click and redirects to requests tab on Allow', async () => {
    // Arrange
    render(
      <NotificationInbox
        userId="user-1"
        initialNotifications={[notificationFactory.buildAccessRequest()]}
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

describe('NotificationInbox client load', () => {
  afterEach(() => {
    inboxResult.data = null;
    inboxResult.error = null;
  });

  it('loads notifications after mount without blocking on initial rows', async () => {
    // Arrange
    inboxResult.data = [
      notificationFactory.build({ message: 'Hello from the inbox' }),
    ];

    // Act
    render(<NotificationInbox userId="user-1" />);

    // Assert
    expect(await screen.findByText('Hello from the inbox')).toBeInTheDocument();
  });

  it('shows a retry action when the inbox query fails', async () => {
    // Arrange
    inboxResult.error = { message: 'TimeoutError: aborted' };

    render(<NotificationInbox userId="user-1" />);

    expect(
      await screen.findByText("Couldn't load notifications")
    ).toBeInTheDocument();

    // Act
    inboxResult.error = null;
    inboxResult.data = [
      notificationFactory.build({ message: 'Recovered notification' }),
    ];
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    // Assert
    expect(
      await screen.findByText('Recovered notification')
    ).toBeInTheDocument();
  });
});

describe('NotificationInbox unread badge', () => {
  afterEach(() => {
    inboxResult.data = null;
    inboxResult.error = null;
  });

  it('shows the numeric unread count on the bell through nine items', () => {
    // Arrange
    const unread = notificationFactory.buildList(3, { read_status: false });

    // Act
    render(<NotificationInbox userId="user-1" initialNotifications={unread} />);

    // Assert
    expect(
      screen.getByRole('button', { name: 'View notifications, 3 unread' })
    ).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows a star on the bell when unread count exceeds nine', () => {
    // Arrange
    const unread = notificationFactory.buildList(10, { read_status: false });

    // Act
    render(<NotificationInbox userId="user-1" initialNotifications={unread} />);

    // Assert
    expect(
      screen.getByRole('button', {
        name: 'View notifications, more than 9 unread',
      })
    ).toBeInTheDocument();
    expect(screen.queryByText('9+')).not.toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
  });
});
