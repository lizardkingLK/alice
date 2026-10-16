import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContextMenu } from '@repo/ui/components/ui/context-menu';
import { WorkflowDesignerContextMenuContent } from '@/app/projects/_components/project-details/workflow-designer-context-menu';

vi.mock(
  '@repo/ui/components/ui/context-menu',
  () => import('../mocks/context-menu')
);

describe('WorkflowDesignerContextMenuContent', () => {
  it('lists commands with shortcuts and runs enabled actions', () => {
    // Arrange
    const addState = vi.fn();
    const copyState = vi.fn();
    render(
      <ContextMenu>
        <WorkflowDesignerContextMenuContent
          canEdit
          manageBusy={false}
          hasSelection
          hasStateSelection
          hasClipboard={false}
          handlers={{
            addState,
            copyState,
            cutState: vi.fn(),
            pasteState: vi.fn(),
            undo: vi.fn(),
            deleteSelection: vi.fn(),
            clearSelection: vi.fn(),
          }}
        />
      </ContextMenu>
    );

    // Act
    expect(screen.getByTestId('workflow-designer-context-menu')).toBeTruthy();
    expect(screen.getByText('Ctrl/Cmd + Alt + N')).toBeTruthy();
    expect(screen.getByText('Ctrl/Cmd + C')).toBeTruthy();
    fireEvent.click(screen.getByTestId('workflow-designer-context-addState'));
    fireEvent.click(screen.getByTestId('workflow-designer-context-copyState'));

    // Assert
    expect(addState).toHaveBeenCalledOnce();
    expect(copyState).toHaveBeenCalledOnce();
    expect(
      screen.getByTestId('workflow-designer-context-pasteState')
    ).toBeDisabled();
  });

  it('disables edit commands when view-only', () => {
    // Arrange
    render(
      <ContextMenu>
        <WorkflowDesignerContextMenuContent
          canEdit={false}
          manageBusy={false}
          hasSelection
          hasStateSelection
          hasClipboard
          handlers={{
            addState: vi.fn(),
            copyState: vi.fn(),
            cutState: vi.fn(),
            pasteState: vi.fn(),
            undo: vi.fn(),
            deleteSelection: vi.fn(),
            clearSelection: vi.fn(),
          }}
        />
      </ContextMenu>
    );

    // Assert
    expect(
      screen.getByTestId('workflow-designer-context-addState')
    ).toBeDisabled();
    expect(
      screen.getByTestId('workflow-designer-context-copyState')
    ).toBeDisabled();
    expect(
      screen.getByTestId('workflow-designer-context-clearSelection')
    ).not.toBeDisabled();
  });
});
