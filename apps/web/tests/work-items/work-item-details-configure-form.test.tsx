import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkItemDetailsConfigureForm } from '@/app/work-items/_components/work-item-details/work-item-details-configure-form';
import {
  DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
  normalizeWorkItemDetailsPreferences,
} from '@/app/work-items/_helpers/work-item-details-preferences';

describe('WorkItemDetailsConfigureForm', () => {
  it('toggles an optional section and notifies onChange', () => {
    const onChange = vi.fn();
    const value = normalizeWorkItemDetailsPreferences(
      DEFAULT_WORK_ITEM_DETAILS_PREFERENCES
    );

    render(<WorkItemDetailsConfigureForm value={value} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Linked issues'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.objectContaining({ linkedIssues: false }),
      })
    );
  });

  it('disables more-fields item switches when the section is off', () => {
    const value = normalizeWorkItemDetailsPreferences({
      ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
      sections: {
        ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.sections,
        moreFields: false,
      },
    });

    render(<WorkItemDetailsConfigureForm value={value} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Short ID')).toBeDisabled();
    expect(screen.getByLabelText('Created date')).toBeDisabled();
  });

  it('disables details field switches when Details section is off', () => {
    const value = normalizeWorkItemDetailsPreferences({
      ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
      sections: {
        ...DEFAULT_WORK_ITEM_DETAILS_PREFERENCES.sections,
        details: false,
      },
    });

    render(<WorkItemDetailsConfigureForm value={value} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Assignee')).toBeDisabled();
    expect(screen.getByLabelText('Priority')).toBeDisabled();
  });

  it('lists Details, Attachments, and Development as optional sections', () => {
    render(
      <WorkItemDetailsConfigureForm
        value={normalizeWorkItemDetailsPreferences(
          DEFAULT_WORK_ITEM_DETAILS_PREFERENCES
        )}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByLabelText('Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Attachments')).toBeInTheDocument();
    expect(screen.getByLabelText('Development')).toBeInTheDocument();
  });

  it('changes banner color via radio', () => {
    const onChange = vi.fn();
    const value = normalizeWorkItemDetailsPreferences(
      DEFAULT_WORK_ITEM_DETAILS_PREFERENCES
    );

    render(<WorkItemDetailsConfigureForm value={value} onChange={onChange} />);

    fireEvent.click(screen.getByLabelText('Type color'));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ bannerColor: 'type' })
    );
  });
});
