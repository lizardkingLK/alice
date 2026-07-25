import { AlertCircle, CheckCircle } from '@repo/ui/lib/icons';

type FormStatusAlertsProps = {
  readonly error?: string | null;
  readonly success?: string | null;
};

/**
 * Shared in-dialog / in-form status alerts for work-item mutations.
 * Prefer these over toasts when the save UX lives inside a dialog or form.
 */
export function FormStatusAlerts({
  error,
  success,
}: Readonly<FormStatusAlertsProps>) {
  return (
    <>
      {error ? (
        <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}
    </>
  );
}
