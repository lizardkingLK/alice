import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Step5Team } from '@/app/projects/_components/project-form-team-step';
import { userFactory } from '../factories/user.factory';

vi.mock('@/components/searchable-select', () => ({
  SearchableSelect: ({ placeholder }: Readonly<{ placeholder?: string }>) => (
    <div data-testid="team-manager-select">{placeholder}</div>
  ),
}));

vi.mock('@/app/projects/_components/project-form-quick-create-user', () => ({
  ProjectFormQuickCreateUser: () => null,
}));

describe('Step5Team member search', () => {
  it('filters the member list by name or email', () => {
    const users = [
      userFactory.build({
        id: 'u-alice',
        name: 'Alice Admin',
        email: 'admin@alice.dev',
        role: 'admin',
      }),
      userFactory.build({
        id: 'u-andriy',
        name: 'Andriy Lunin',
        email: 'andriy.l@alice.dev',
        role: 'member',
      }),
      userFactory.build({
        id: 'u-avanthi',
        name: 'Avanthi Amunugama',
        email: 'avanthi.amunugama@1billiontech.com',
        role: 'manager',
      }),
    ];

    render(
      <Step5Team
        projectMemberIds={['u-avanthi']}
        setProjectMemberIds={vi.fn()}
        selectedOwnerId="u-avanthi"
        setSelectedOwnerId={vi.fn()}
        users={users}
        onUserCreated={vi.fn()}
        createInitialTeam
        setCreateInitialTeam={vi.fn()}
        teamName="BM"
        setTeamName={vi.fn()}
        teamDescription=""
        setTeamDescription={vi.fn()}
        teamManagerId="u-avanthi"
        setTeamManagerId={vi.fn()}
        teamTechStack=""
        setTeamTechStack={vi.fn()}
        teamMemberIds={[]}
        setTeamMemberIds={vi.fn()}
      />
    );

    const teamList = screen.getByLabelText('Search team members').closest('div')
      ?.parentElement?.parentElement;
    expect(teamList).toBeTruthy();
    expect(teamList).toHaveTextContent(/Alice Admin/);
    expect(teamList).toHaveTextContent(/Andriy Lunin/);

    fireEvent.change(screen.getByLabelText('Search team members'), {
      target: { value: 'andriy' },
    });

    expect(teamList).not.toHaveTextContent(/Alice Admin/);
    expect(teamList).toHaveTextContent(/Andriy Lunin/);
  });
});
