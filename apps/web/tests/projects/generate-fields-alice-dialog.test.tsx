import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GenerateFieldsAliceDialog } from '@/app/projects/_components/project-details/generate-fields-alice-dialog';
import { generateFieldsSchemaWithAlice } from '@/app/chat/_services/chat.mutations.client';

vi.mock('@/app/chat/_services/chat.mutations.client', () => ({
  generateFieldsSchemaWithAlice: vi.fn(),
}));

describe('GenerateFieldsAliceDialog component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dialog header, description, prompt input, and starter suggestions when open', () => {
    render(
      <GenerateFieldsAliceDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerated={vi.fn()}
        onError={vi.fn()}
      />
    );

    expect(screen.getByText('Generate Fields with Alice')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Describe your team's custom fields in natural language/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(
        /e\.g\. I want every work item in this project to have a MoSCoW rating/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/\+ MoSCoW rating and acceptance criteria/i)
    ).toBeInTheDocument();
  });

  it('populates prompt textarea when clicking a starter suggestion chip', () => {
    render(
      <GenerateFieldsAliceDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerated={vi.fn()}
        onError={vi.fn()}
      />
    );

    const chip = screen.getByText(/\+ MoSCoW rating and acceptance criteria/i);
    fireEvent.click(chip);

    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>(
      /e\.g\. I want every work item in this project to have a MoSCoW rating/i
    );
    expect(textarea.value).toBe('MoSCoW rating and acceptance criteria');
  });

  it('disables "Generate Schema" button when prompt is empty', () => {
    render(
      <GenerateFieldsAliceDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerated={vi.fn()}
        onError={vi.fn()}
      />
    );

    const generateBtn = screen.getByRole('button', {
      name: /generate schema/i,
    });
    expect(generateBtn).toBeDisabled();
  });

  it('calls generateFieldsSchemaWithAlice and triggers onGenerated upon success', async () => {
    const onGenerated = vi.fn();
    const onOpenChange = vi.fn();
    const mockSchema = {
      type: 'object',
      properties: {
        moscowRating: { type: 'string', title: 'MoSCoW Rating' },
      },
    };

    vi.mocked(generateFieldsSchemaWithAlice).mockResolvedValueOnce({
      schema: mockSchema,
    });

    render(
      <GenerateFieldsAliceDialog
        open={true}
        onOpenChange={onOpenChange}
        currentSchema={{ existing: true }}
        onGenerated={onGenerated}
        onError={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText(
      /e\.g\. I want every work item in this project to have a MoSCoW rating/i
    );
    fireEvent.change(textarea, {
      target: { value: 'Add MoSCoW rating field' },
    });

    const generateBtn = screen.getByRole('button', {
      name: /generate schema/i,
    });
    expect(generateBtn).not.toBeDisabled();
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(generateFieldsSchemaWithAlice).toHaveBeenCalledWith(
        'Add MoSCoW rating field',
        { existing: true }
      );
      expect(onGenerated).toHaveBeenCalledWith(mockSchema);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('triggers onError when Alice generation fails', async () => {
    const onError = vi.fn();
    vi.mocked(generateFieldsSchemaWithAlice).mockRejectedValueOnce(
      new Error('Failed to contact Alice AI server')
    );

    render(
      <GenerateFieldsAliceDialog
        open={true}
        onOpenChange={vi.fn()}
        onGenerated={vi.fn()}
        onError={onError}
      />
    );

    const textarea = screen.getByPlaceholderText(
      /e\.g\. I want every work item in this project to have a MoSCoW rating/i
    );
    fireEvent.change(textarea, {
      target: { value: 'Create custom fields' },
    });

    const generateBtn = screen.getByRole('button', {
      name: /generate schema/i,
    });
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to contact Alice AI server');
    });
  });
});
