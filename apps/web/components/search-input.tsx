'use client';

import { Search } from '@repo/ui/lib/icons';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';

/* eslint-disable no-unused-vars */
interface SearchInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
}
/* eslint-enable no-unused-vars */

/** Search box with a leading icon, shared by the feature list tables. */
export function SearchInput({
  value,
  onValueChange,
  placeholder,
  className,
}: Readonly<SearchInputProps>) {
  return (
    <div className={cn('relative max-w-md flex-1', className)}>
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
