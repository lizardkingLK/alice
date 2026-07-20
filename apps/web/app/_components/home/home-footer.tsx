import Link from 'next/link';
import { Separator } from '@repo/ui/components/ui/separator';

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
      { href: '/files', label: 'Files' },
    ],
  },
  {
    title: 'Team',
    links: [
      { href: '/users', label: 'Users' },
      { href: '/manager', label: 'Team' },
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
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact' },
    ],
  },
] as const;

export function HomeFooter() {
  return (
    <footer className="border-border/60 bg-muted/20 flex min-h-dvh snap-start snap-always flex-col border-t px-6 pt-12 pb-8">
      <div className="mx-auto mt-auto w-full max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))] lg:gap-8">
          <div className="max-w-xs">
            <p className="text-base font-semibold tracking-tight">Jira Teams</p>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              A focused workspace for boards, backlogs, and delivery.
            </p>
          </div>

          {footerColumns.map((column) => (
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
          <p>© {new Date().getFullYear()} Jira Teams</p>
          <p>Built for planning, delivery, and team visibility.</p>
        </div>
      </div>
    </footer>
  );
}
