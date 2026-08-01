import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SearchableSelect } from '@/components/searchable-select';
import { pickComboboxOption } from '../helpers/pick-combobox-option';

describe('SearchableSelect', () => {
  it('keeps selection in uncontrolled form mode (name without value)', async () => {
    // Arrange
    render(
      <form>
        <SearchableSelect
          id="userId"
          name="userId"
          required
          ariaLabel="Select user to allocate"
          options={[
            { value: 'u1', label: 'Ada Lovelace (ada@example.com)' },
            { value: 'u2', label: 'Grace Hopper (grace@example.com)' },
          ]}
        />
      </form>
    );

    // Act
    await pickComboboxOption(
      'Select user to allocate',
      /Ada Lovelace \(ada@example.com\)/i
    );

    // Assert — form field must retain the chosen id (not reset to empty)
    await waitFor(() => {
      expect(screen.getByDisplayValue('u1')).toBeInTheDocument();
    });
  });
});
