import Link from 'next/link';
import { Separator } from '@repo/ui/components/ui/separator';
import { cn } from '@repo/ui/lib/utils';

const footerColumns = [
  {
    title: 'Workspace',
    links: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/board', label: 'Board' },
      { href: '/backlog', label: 'Backlog' },
      { href: '/projects', label: 'Projects' },
      { href: '/work-items', label: 'Work items' },
      { href: '/sprints', label: 'Sprints' },
    ],
  },
  {
    title: 'People',
    links: [
      { href: '/users', label: 'Users' },
      { href: '/member', label: 'My work' },
      { href: '/profile', label: 'Profile' },
    ],
  },
  {
    title: 'Account',
    links: [
      { href: '/login', label: 'Sign in' },
      { href: '/signup', label: 'Create account' },
      { href: '/forgot-password', label: 'Forgot password' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/#pricing', label: 'Pricing' },
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
] as const;

const APP_ONLY_COLUMN_TITLES = new Set(['Workspace', 'People']);

type HomeFooterProps = {
  /** Show Workspace / People links (allowlisted signed-in users). */
  showAppLinks?: boolean;
  /** `snap` fills a home scroll panel; `inline` sizes to content for other pages. */
  variant?: 'snap' | 'inline';
};

export function HomeFooter({
  showAppLinks = false,
  variant = 'snap',
}: Readonly<HomeFooterProps>) {
  const columns = showAppLinks
    ? footerColumns
    : footerColumns.filter(
        (column) => !APP_ONLY_COLUMN_TITLES.has(column.title)
      );

  return (
    <footer
      className={cn(
        'border-border/60 bg-muted/20 flex flex-col border-t px-6 pt-12 pb-8',
        variant === 'snap' ? 'h-dvh shrink-0 snap-start' : 'min-h-0'
      )}
    >
      <div
        className={cn(
          'mx-auto w-full max-w-6xl',
          variant === 'snap' ? 'mt-auto' : null
        )}
      >
        <div
          className={cn(
            'grid gap-10 sm:grid-cols-2 lg:gap-8',
            columns.length === footerColumns.length
              ? 'lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]'
              : 'lg:grid-cols-[1.4fr_repeat(2,minmax(0,1fr))]'
          )}
        >
          <div className="max-w-xs">
            <p className="text-base font-semibold tracking-tight">Alice</p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              A focused workspace for boards, backlogs, and delivery.
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="text-sm font-medium tracking-tight">
                {column.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <Separator className="mt-10" />

        <div className="text-muted-foreground mt-6 flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Alice</p>
          <p>Built for planning, delivery, and team visibility.</p>
        </div>
      </div>
    </footer>
  );
}
