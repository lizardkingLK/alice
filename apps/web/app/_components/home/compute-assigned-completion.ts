/** Round assigned Done / total to a 0–100 percentage pill value. */
export function computeAssignedCompletionPercent(
  doneCount: number,
  totalCount: number
): number {
  if (totalCount <= 0 || doneCount <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((doneCount / totalCount) * 100));
}
