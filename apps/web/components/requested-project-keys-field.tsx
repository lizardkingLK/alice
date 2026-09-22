import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';

const DEFAULT_HELPER =
  'Comma-separated project keys you need. Admins use this when granting guest access.';

type RequestedProjectKeysFieldProps = {
  readonly id?: string;
  readonly helperText?: string;
};

/** Shared free-text project keys input for access-request forms. */
export function RequestedProjectKeysField({
  id = 'requestedProjectKeys',
  helperText = DEFAULT_HELPER,
}: Readonly<RequestedProjectKeysFieldProps>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Project keys (optional)</Label>
      <Input
        id={id}
        name="requestedProjectKeys"
        type="text"
        maxLength={500}
        placeholder="e.g. ACME, BETA"
        className="h-10"
        autoComplete="off"
      />
      <p className="text-muted-foreground text-xs">{helperText}</p>
    </div>
  );
}
