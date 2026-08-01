import { fireEvent, screen } from '@testing-library/react';

type ComboboxByLabel = { readonly label: string | RegExp };
type ComboboxByName = { readonly name: string | RegExp };
type ComboboxQuery = ComboboxByLabel | ComboboxByName;
type ComboboxLocator = ComboboxQuery | string | RegExp;

function normalizeQuery(query: ComboboxLocator): ComboboxQuery {
  if (typeof query === 'string' || query instanceof RegExp) {
    return { label: query };
  }
  return query;
}

function getComboboxInput(query: ComboboxQuery): HTMLElement {
  if ('label' in query) {
    return screen.getByLabelText(query.label);
  }
  return screen.getByRole('combobox', { name: query.name });
}

/** Open a searchable combobox popup (Base UI). */
export async function openCombobox(
  query: ComboboxLocator
): Promise<HTMLElement> {
  const input = getComboboxInput(normalizeQuery(query));
  fireEvent.focus(input);
  fireEvent.keyDown(input, { key: 'ArrowDown' });
  return input;
}

/** Open a searchable combobox and choose an option. */
export async function pickComboboxOption(
  query: ComboboxLocator,
  optionName: string | RegExp
): Promise<void> {
  await openCombobox(query);
  const option = await screen.findByRole('option', { name: optionName });
  fireEvent.click(option);
}

/** Open a searchable combobox and return its option elements. */
export async function getComboboxOptions(
  query: ComboboxLocator
): Promise<HTMLElement[]> {
  await openCombobox(query);
  return screen.findAllByRole('option');
}
