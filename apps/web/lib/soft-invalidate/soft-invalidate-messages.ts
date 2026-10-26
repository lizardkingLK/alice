export type SoftInvalidateReason = 'workflow' | 'role';

export const SOFT_INVALIDATE_MESSAGES: Record<SoftInvalidateReason, string> = {
  workflow:
    "This project's workflow was updated. Refresh to see the latest board and state options.",
  role: 'Your access was updated. Refresh to see your new permissions.',
};
