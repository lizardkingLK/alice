'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { LoadingButton } from '@repo/ui/components/ui/loading-button';

type PendingSubmitButtonProps = Omit<
  ComponentProps<typeof LoadingButton>,
  'loading' | 'type'
> & {
  loadingLabel: string;
};

export function PendingSubmitButton({
  loadingLabel,
  children,
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <LoadingButton
      type="submit"
      loading={pending}
      loadingLabel={loadingLabel}
      {...props}
    >
      {children}
    </LoadingButton>
  );
}
