import Link from 'next/link';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  getHomeQuickLinks,
  type HomeQuickLink,
} from '@/app/_components/home/home-quick-links';

type HomeQuickLinksPanelProps = {
  readonly role: string;
  /** `rail` stacks cards in a narrow right column; `grid` is a 2-up fill. */
  readonly layout?: 'rail' | 'grid';
};

function QuickLinkCard({ link }: Readonly<{ link: HomeQuickLink }>) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className={cn(
        'border-border/70 bg-card/60 hover:bg-muted/50 group flex gap-3 rounded-xl border p-4',
        'dashboard-widget-glass shadow-none transition-colors'
      )}
    >
      <span
        className={cn(
          'bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center',
          'rounded-lg'
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-semibold tracking-tight">
          {link.title}
        </span>
        <TruncatedText className="text-muted-foreground text-xs">
          {link.description}
        </TruncatedText>
      </span>
    </Link>
  );
}

export function HomeQuickLinksPanel({
  role,
  layout = 'grid',
}: Readonly<HomeQuickLinksPanelProps>) {
  const links = getHomeQuickLinks(role);

  return (
    <section className="space-y-3">
      <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
        Quick links
      </h2>
      <div
        className={cn(
          'grid gap-3',
          layout === 'rail' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
        )}
      >
        {links.map((link) => (
          <QuickLinkCard key={link.id} link={link} />
        ))}
      </div>
    </section>
  );
}
