export type ActionState = {
  success: boolean;
  error: string | null;
};

export function actionSuccess(): ActionState {
  return { success: true, error: null };
}

export function actionFailure(error: string): ActionState {
  return { success: false, error };
}

export function unexpectedActionError(err: unknown): ActionState {
  return actionFailure(
    err instanceof Error ? err.message : 'An unexpected error occurred.'
  );
}

export function firstValidationError(
  issues: { message: string }[]
): ActionState {
  return actionFailure(issues[0]?.message ?? 'Invalid input data.');
}
