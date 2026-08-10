'use client';

import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { cn } from '@repo/ui/lib/utils';

type ColumnOptionRowProps = {
  readonly id: string;
  readonly label: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly inputIdPrefix: string;
  // eslint-disable-next-line no-unused-vars
  readonly onCheckedChange: (checked: boolean) => void;
};

export function ColumnOptionRow({
  id,
  label,
  checked,
  disabled,
  inputIdPrefix,
  onCheckedChange,
}: Readonly<ColumnOptionRowProps>) {
  const inputId = `${inputIdPrefix}-${id}`;
  return (
    <div
      className={cn(
        'hover:bg-muted/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
        disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
      )}
    >
      <Checkbox
        id={inputId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="cursor-pointer"
      />
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <span className="min-w-0 flex-1">{label}</span>
        {disabled ? (
          <span className="text-muted-foreground text-xs">Required</span>
        ) : null}
      </label>
    </div>
  );
}
