import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { OnlineMembersAvatarGroup } from '@/components/online-members-avatar-group';
import type { ReactNode } from 'react';

const members = [
  { id: 'self', name: 'You', profilePicture: null },
  { id: 'u1', name: 'Ada', profilePicture: null },
  { id: 'u2', name: 'Bob', profilePicture: null },
  { id: 'u3', name: 'Cara', profilePicture: null },
  { id: 'u4', name: 'Dan', profilePicture: null },
];

function renderGroup(ui: ReactNode) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe('OnlineMembersAvatarGroup', () => {
  it('renders nothing when nobody else is online', () => {
    const { container } = renderGroup(
      <OnlineMembersAvatarGroup
        members={members}
        currentUserId="self"
        isUserOnline={() => false}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('excludes the current user even when online', () => {
    renderGroup(
      <OnlineMembersAvatarGroup
        members={members}
        currentUserId="self"
        isUserOnline={(id) => id === 'self' || id === 'u1'}
      />
    );
    expect(screen.getByLabelText('Ada online')).toBeInTheDocument();
    expect(screen.queryByLabelText('You online')).not.toBeInTheDocument();
  });

  it('omits the online pill when only one other member is online', () => {
    renderGroup(
      <OnlineMembersAvatarGroup
        members={members}
        currentUserId="self"
        isUserOnline={(id) => id === 'u1'}
      />
    );
    expect(screen.getByLabelText('Online project members')).not.toHaveClass(
      'rounded-full'
    );
  });

  it('shows the online pill when two or more others are online', () => {
    renderGroup(
      <OnlineMembersAvatarGroup
        members={members}
        currentUserId="self"
        isUserOnline={(id) => id === 'u1' || id === 'u2'}
      />
    );
    expect(screen.getByLabelText('Online project members')).toHaveClass(
      'rounded-full'
    );
  });

  it('shows +n when more than three others are online', () => {
    renderGroup(
      <OnlineMembersAvatarGroup
        members={members}
        currentUserId="self"
        isUserOnline={(id) => id !== 'self'}
      />
    );
    expect(screen.getByLabelText('Ada online')).toBeInTheDocument();
    expect(screen.getByLabelText('Bob online')).toBeInTheDocument();
    expect(screen.getByLabelText('Cara online')).toBeInTheDocument();
    expect(screen.getByLabelText('1 more online')).toHaveTextContent('+1');
    expect(screen.queryByLabelText('Dan online')).not.toBeInTheDocument();
  });
});
