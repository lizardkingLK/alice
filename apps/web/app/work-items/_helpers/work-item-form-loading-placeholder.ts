/** Placeholder while a searchable option list is still empty and loading. */
export function loadingAwarePlaceholder(
  isLoadingEmpty: boolean,
  loadingText: string,
  readyText: string
): string {
  if (isLoadingEmpty) {
    return loadingText;
  }
  return readyText;
}

export function isOptionsLoadingEmpty(
  isLoading: boolean,
  optionCount: number
): boolean {
  return isLoading && optionCount === 0;
}

/** Classic sprint select placeholder (avoids nested ternaries). */
export function classicSprintPlaceholder(
  projectId: string,
  isLoading: boolean,
  optionCount: number
): string {
  if (!projectId) {
    return 'Select a project first';
  }
  return loadingAwarePlaceholder(
    isOptionsLoadingEmpty(isLoading, optionCount),
    'Loading sprints…',
    'Search sprints…'
  );
}
