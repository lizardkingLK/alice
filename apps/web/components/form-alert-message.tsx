import { AlertCircle, CheckCircle } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type FormAlertMessageProps = {
  message: string | null;
  isError: boolean;
};

export function FormAlertMessage({
  message,
  isError,
}: Readonly<FormAlertMessageProps>) {
  if (!message) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border p-3 text-sm',
        isError
          ? 'text-destructive bg-destructive/10 border-destructive/20'
          : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
      )}
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle className="h-4 w-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}
