import Link from 'next/link';
import { AuthControls } from '@/app/dashboard/_components/dashboard-auth';
import { appTitle } from '@/app/_shared/values';
import { cn } from '@repo/ui/lib/utils';

const NAV_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
] as const;

type HomeNavbarProps = {
  readonly email?: string | null;
  readonly profilePicture?: string | null;
};

export function HomeNavbar({
  email,
  profilePicture,
}: Readonly<HomeNavbarProps>) {
  return (
    <header className="border-border/60 bg-background shrink-0 border-b">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          aria-label={`${appTitle} home`}
        >
          <span
            className={cn(
              'bg-primary text-primary-foreground flex size-8 items-center justify-center',
              'rounded-lg text-sm font-bold'
            )}
          >
            A
          </span>
          <span className="text-base font-semibold tracking-tight">
            {appTitle}
          </span>
        </Link>

        <nav
          aria-label="Marketing"
          className="hidden items-center gap-7 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <AuthControls email={email} profilePicture={profilePicture} />
      </div>
    </header>
  );
}
