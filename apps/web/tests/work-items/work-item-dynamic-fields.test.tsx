import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WorkItemSidebar from '@/app/work-items/_components/work-item-details/work-item-details-sidebar';
import {
  SafeDynamicFieldsSection,
  DynamicFieldsErrorBoundary,
  DynamicFieldsErrorNotice,
} from '@/app/work-items/_components/work-item-details/safe-dynamic-fields-section';
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
      releaseNotesIncluded: {
        type: 'boolean',
        title: 'Include in Release Notes',
        default: false,
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

  it('toggles boolean field switch and calls onWorkItemPatched', async () => {
    const onWorkItemPatched = vi.fn();
    const item = workItemFactory.build({
      description: {
        type: 'doc',
        attrs: {
          dynamicFields: {
            releaseNotesIncluded: false,
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

    expect(screen.getByText('Include in Release Notes')).toBeInTheDocument();
    const editBtn = screen.getByLabelText('Edit Include in Release Notes');
    fireEvent.click(editBtn);

    const switchBtn = screen.getByRole('switch');
    expect(switchBtn).toBeInTheDocument();

    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(onWorkItemPatched).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.objectContaining({
            attrs: expect.objectContaining({
              dynamicFields: expect.objectContaining({
                releaseNotesIncluded: true,
              }),
            }),
          }),
        })
      );
    });
  });

  it('enforces non-validation invariant: items without dynamic fields render and operate normally', () => {
    const emptyItem = workItemFactory.build({
      description: null,
    });

    const { container } = render(
      <WorkItemSidebar
        workItem={emptyItem}
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

    expect(container).toBeInTheDocument();
    expect(screen.queryByText(/validation error/i)).not.toBeInTheDocument();
  });
});

describe('SafeDynamicFieldsSection & Graceful Degradation', () => {
  it('returns null gracefully when schema is malformed or invalid JSON object', () => {
    const { container: c1 } = render(
      <SafeDynamicFieldsSection schema="not an object" values={{}} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <SafeDynamicFieldsSection
        schema={{ invalid_property: 123 }}
        values={{}}
      />
    );
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(
      <SafeDynamicFieldsSection schema={{ type: 'array' }} values={{}} />
    );
    expect(c3.firstChild).toBeNull();
  });

  it('renders DynamicFieldsErrorNotice when DynamicFieldsErrorBoundary catches an error', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    function ExplodingComponent(): React.ReactNode {
      throw new Error('Explosion during field rendering');
    }

    render(
      <DynamicFieldsErrorBoundary fallback={<DynamicFieldsErrorNotice />}>
        <ExplodingComponent />
      </DynamicFieldsErrorBoundary>
    );

    expect(
      screen.getByText(
        'Some custom fields could not be displayed due to a configuration mismatch.'
      )
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });
});
