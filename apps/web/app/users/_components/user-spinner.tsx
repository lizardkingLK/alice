import { cn } from '@repo/ui/lib/utils';
import { LoaderIcon } from 'lucide-react';

interface CustomSpinnerProps {
  className?: string;
}

const Spinner = ({ className, ...props }: Readonly<CustomSpinnerProps>) => {
  return (
    <LoaderIcon
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
};

export function CustomSpinner() {
  return (
    <div className="flex items-center gap-4">
      <Spinner />
    </div>
  );
}
