import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectFieldsErrorDialog } from '@/app/projects/_components/project-details/project-fields-error-dialog';

describe('ProjectFieldsErrorDialog component', () => {
  it('renders nothing when error is null', () => {
    const { container } = render(
      <ProjectFieldsErrorDialog open={true} error={null} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('categorizes permission-related errors with "Permission Denied"', () => {
    render(
      <ProjectFieldsErrorDialog
        open={true}
        error="Unauthorized: Only project managers or administrators can edit fields"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Permission Denied')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Only project managers and administrators can edit and save dynamic field configurations.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Only project managers or administrators can edit fields/
      )
    ).toBeInTheDocument();
  });

  it('categorizes syntax errors with "JSON Syntax Error"', () => {
    render(
      <ProjectFieldsErrorDialog
        open={true}
        error="Unexpected token in JSON at position 42 (line 3)"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('JSON Syntax Error')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The schema contains invalid JSON syntax. Please correct the syntax before proceeding.'
      )
    ).toBeInTheDocument();
  });

  it('categorizes schema validation errors with "Schema Validation Error"', () => {
    render(
      <ProjectFieldsErrorDialog
        open={true}
        error="Schema validation failed: properties.title is required"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Schema Validation Error')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The schema does not conform to the required Project Fields specification.'
      )
    ).toBeInTheDocument();
  });

  it('supports custom title and description overrides', () => {
    render(
      <ProjectFieldsErrorDialog
        open={true}
        title="Remove Field Template: Defect Severity"
        description="Work item values will be removed under this template."
        error="Field: Defect Severity (key: severity)\n• PROJ-1: Blocker"
        onClose={vi.fn()}
      />
    );

    expect(
      screen.getByText('Remove Field Template: Defect Severity')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Work item values will be removed under this template.')
    ).toBeInTheDocument();
    expect(screen.getByText(/• PROJ-1: Blocker/)).toBeInTheDocument();
  });

  it('calls onConfirm when OK button is clicked', () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();

    render(
      <ProjectFieldsErrorDialog
        open={true}
        error="Some error"
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );

    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('falls back to calling onClose when onConfirm is not provided', () => {
    const onClose = vi.fn();

    render(
      <ProjectFieldsErrorDialog
        open={true}
        error="Some error"
        onClose={onClose}
      />
    );

    const okButton = screen.getByRole('button', { name: 'OK' });
    fireEvent.click(okButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders cancel button and triggers onClose when showCancel is true', () => {
    const onClose = vi.fn();

    render(
      <ProjectFieldsErrorDialog
        open={true}
        error="Warning details"
        showCancel={true}
        cancelText="Cancel Action"
        onClose={onClose}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel Action' });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
