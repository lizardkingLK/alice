import * as React from 'react';
import { type VariantProps } from 'class-variance-authority';

import { Button, buttonVariants } from '@repo/ui/components/ui/button';
import { Spinner } from '@repo/ui/components/ui/spinner';

type LoadingButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    loading?: boolean;
    loadingLabel?: React.ReactNode;
  };

function LoadingButton({
  loading = false,
  loadingLabel,
  disabled,
  children,
  ...props
}: LoadingButtonProps) {
  return (
    <Button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Spinner data-icon="inline-start" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

export { LoadingButton };
