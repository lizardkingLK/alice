import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';

type HomeAuthButtonsProps = {
  readonly isSignedIn: boolean;
  readonly signedInLabel?: string;
  readonly signedOutPrimaryLabel?: string;
  readonly signedOutSecondaryLabel?: string;
  readonly showSignedOutSecondary?: boolean;
  readonly className?: string;
};

export function HomeAuthButtons({
  isSignedIn,
  signedInLabel = 'Open dashboard',
  signedOutPrimaryLabel = 'Get Started - It is Free',
  signedOutSecondaryLabel = 'Sign in',
  showSignedOutSecondary = true,
  className,
}: Readonly<HomeAuthButtonsProps>) {
  if (isSignedIn) {
    return (
      <Button asChild size="lg" className={cn('cursor-pointer', className)}>
        <Link href="/dashboard">{signedInLabel}</Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild size="lg" className={cn('cursor-pointer', className)}>
        <Link href="/signup">{signedOutPrimaryLabel}</Link>
      </Button>
      {showSignedOutSecondary ? (
        <Button asChild size="lg" variant="outline" className="cursor-pointer">
          <Link href="/login">{signedOutSecondaryLabel}</Link>
        </Button>
      ) : null}
    </>
  );
}
