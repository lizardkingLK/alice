import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkItemSidebar from '@/app/work-items/_components/work-item-details/work-item-details-sidebar';
import { workItemFactory } from '../factories/workItem.factory';
import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@repo/ui/components/ui/sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(
  '@/app/work-items/_components/work-item-details/work-item-field-patch-dialog',
  () => ({
    WORK_ITEM_PATCH_FIELD_CONFIG: {
      status: { title: 'Status' },
      assignee_id: { label: 'Assignee', unassignedLabel: 'Unassigned' },
      reporter_id: { label: 'Reporter', unassignedLabel: 'Unassigned' },
      labels: { label: 'Labels' },
    },
    WORK_ITEM_STATUSES: ['ToDo', 'InProgress', 'Done'],
    WorkItemFieldPatchDialog: () => null,
  })
);

vi.mock('@/app/work-items/_services/work-items.reads.client', () => ({
  getLinkedPRs: vi.fn().mockResolvedValue({ prs: [] }),
}));

vi.mock('@/app/work-items/_services/work-items.mutations.client', () => ({
  updateWorkItem: vi.fn().mockResolvedValue({
    data: { id: 'item-1', updated_at: '2026-01-01T00:00:01.000Z' },
  }),
}));

const mockProjectWithFields: DbProject = {
  id: 'proj-1',
  name: 'Test Project',
  key: 'TEST',
  description: null,
  status: 'active',
  start_date: null,
  end_date: null,
  owner_id: 'user-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  deleted_at: null,
  attributes_config: {
    type: 'object',
    properties: {
      moscowRating: {
        type: 'string',
        title: 'MoSCoW Rating',
        enum: ['Must', 'Should', 'Could', "Won't"],
      },
      acceptanceCriteria: {
        type: 'string',
        title: 'Acceptance Criteria',
        format: 'multiline',
      },
    },
  },
  workflow_config: null,
} as unknown as DbProject;

describe('WorkItemSidebar Dynamic Fields', () => {
  it('renders Additional Fields section when project has dynamic fields configured', () => {
    const item = workItemFactory.build({
      description: {
        type: 'doc',
        attrs: {
          dynamicFields: {
            moscowRating: 'Must',
            acceptanceCriteria: 'Given user is logged in...',
          },
        },
        content: [],
      } as unknown as DbWorkItem['description'],
    });

    render(
      <WorkItemSidebar
        workItem={item}
        project={mockProjectWithFields}
        childStatuses={[]}
        projectMembers={[]}
        detailsOpen={true}
        setDetailsOpen={vi.fn()}
        moreFieldsOpen={false}
        setMoreFieldsOpen={vi.fn()}
        onWorkItemPatched={vi.fn()}
      />
    );

    expect(screen.getByText('Additional Fields')).toBeInTheDocument();
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();
    expect(screen.getByText('Must')).toBeInTheDocument();
    expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument();
    expect(screen.getByText('Given user is logged in...')).toBeInTheDocument();
  });

  it('displays "Not set" placeholder when field value is missing', () => {
    const item = workItemFactory.build({
      description: null,
    });

    render(
      <WorkItemSidebar
        workItem={item}
        project={mockProjectWithFields}
        childStatuses={[]}
        projectMembers={[]}
        detailsOpen={true}
        setDetailsOpen={vi.fn()}
        moreFieldsOpen={false}
        setMoreFieldsOpen={vi.fn()}
        onWorkItemPatched={vi.fn()}
      />
    );

    expect(screen.getByText('Additional Fields')).toBeInTheDocument();
    expect(screen.getByText('MoSCoW Rating')).toBeInTheDocument();
    const notSetBadges = screen.getAllByText('Not set');
    expect(notSetBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render Additional Fields section when project has no attributes_config', () => {
    const item = workItemFactory.build();

    render(
      <WorkItemSidebar
        workItem={item}
        project={{ ...mockProjectWithFields, attributes_config: null }}
        childStatuses={[]}
        projectMembers={[]}
        detailsOpen={true}
        setDetailsOpen={vi.fn()}
        moreFieldsOpen={false}
        setMoreFieldsOpen={vi.fn()}
        onWorkItemPatched={vi.fn()}
      />
    );

    expect(screen.queryByText('Additional Fields')).not.toBeInTheDocument();
  });

  it('allows inline editing and saves updated value when clicking Save', async () => {
    const onWorkItemPatched = vi.fn();
    const item = workItemFactory.build({
      description: {
        type: 'doc',
        attrs: {
          dynamicFields: {
            acceptanceCriteria: 'Initial criteria',
          },
        },
        content: [],
      } as unknown as DbWorkItem['description'],
    });

    render(
      <WorkItemSidebar
        workItem={item}
        project={mockProjectWithFields}
        childStatuses={[]}
        projectMembers={[]}
        detailsOpen={true}
        setDetailsOpen={vi.fn()}
        moreFieldsOpen={false}
        setMoreFieldsOpen={vi.fn()}
        onWorkItemPatched={onWorkItemPatched}
      />
    );

    // Click edit button for Acceptance Criteria
    const editBtn = screen.getByLabelText('Edit Acceptance Criteria');
    fireEvent.click(editBtn);

    // Textarea should now be visible
    const textarea = screen.getByPlaceholderText(/Enter details/i);
    expect(textarea).toBeInTheDocument();

    // Type new criteria
    fireEvent.change(textarea, {
      target: { value: 'Updated acceptance criteria' },
    });

    // Click Save button
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    // Verify optimistic and patched callback was called
    await waitFor(() => {
      expect(onWorkItemPatched).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.objectContaining({
            attrs: expect.objectContaining({
              dynamicFields: expect.objectContaining({
                acceptanceCriteria: 'Updated acceptance criteria',
              }),
            }),
          }),
        })
      );
    });
  });
});
