import Link from 'next/link';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  formatLabelFirstLetterCapitalized,
  getInitials,
} from '@/app/_shared/utility';
import { HomeCoverBanner } from '@/app/_components/home/home-cover-banner';
import { HomeNotificationsPanel } from '@/app/_components/home/home-notifications-panel';
import { HomeQuickLinksPanel } from '@/app/_components/home/home-quick-links-panel';
import { HomeTimeGreeting } from '@/app/_components/home/home-time-greeting';
import { HomeWipPanel } from '@/app/_components/home/home-wip-panel';
import type { HomeLaunchpadBootstrap } from '@/app/_components/home/home-launchpad.types';
import { projectDetailHref } from '@/app/projects/_helpers/project-links';
import '@/app/dashboard/_components/dashboard-grid.css';

const ROLE_STYLES: Record<string, string> = {
  admin: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  manager:
    'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  member: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

type HomeSignedInLaunchpadProps = {
  readonly bootstrap: HomeLaunchpadBootstrap;
  readonly resetSuccess: boolean;
  readonly accountClosed: boolean;
};

export function HomeSignedInLaunchpad({
  bootstrap,
  resetSuccess,
  accountClosed,
}: Readonly<HomeSignedInLaunchpadProps>) {
  const {
    name,
    handle,
    role,
    avatarUrl,
    coverUrl,
    projects,
    wipItems,
    unreadNotifications,
    completion,
  } = bootstrap;

  const hasFeed = wipItems.length > 0 || unreadNotifications.length > 0;
  const hasAlerts = resetSuccess || accountClosed;
  const showCenterColumn = hasFeed || hasAlerts;
  const greeting = (
    <HomeTimeGreeting
      as="h2"
      showName={false}
      className="text-muted-foreground font-mono text-sm font-normal tracking-wide sm:text-base"
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <HomeCoverBanner coverUrl={coverUrl} />

      {/*
        Grey surface must not clip the avatar: keep cover + body in one scroll
        root so -mt overlap paints over the cover instead of being cut off.
      */}
      <div className="dashboard-productivity-surface flex-1">
        <div className="mx-auto flex w-full max-w-6xl flex-col px-4 pb-10 sm:px-6">
          <div
            className={cn(
              'grid grid-cols-1 gap-8 lg:gap-8 xl:gap-10',
              showCenterColumn
                ? 'lg:grid-cols-[17.5rem_minmax(0,1fr)_15.5rem]'
                : 'lg:grid-cols-[17.5rem_minmax(0,1fr)]'
            )}
          >
            <aside className="relative z-10 -mt-14 space-y-5 sm:-mt-16">
              <div className="space-y-3">
                <Avatar className="border-background size-24 border-4 shadow-md sm:size-28">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={name} />
                  ) : null}
                  <AvatarFallback className="bg-muted text-foreground text-2xl font-semibold sm:text-3xl">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-1.5">
                  <div className="space-y-0.5">
                    <h1
                      className="truncate text-2xl font-semibold tracking-tight"
                      title={name}
                    >
                      {name}
                    </h1>
                    <p className="text-muted-foreground text-sm">{handle}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('capitalize', ROLE_STYLES[role])}
                  >
                    {formatLabelFirstLetterCapitalized(role)}
                  </Badge>
                  {!hasFeed ? greeting : null}
                </div>

                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
              </div>

              <div className="space-y-2.5 pt-1">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Projects
                </h2>
                {projects.length > 0 ? (
                  <ul className="space-y-2">
                    {projects.map((project) => (
                      <li key={project.id}>
                        <Link
                          href={projectDetailHref(project.key ?? project.id)}
                          className="hover:bg-muted/50 flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors"
                        >
                          <Avatar size="sm">
                            <AvatarFallback className="text-[10px] font-semibold">
                              {getInitials(project.key ?? project.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <TruncatedText className="text-sm font-medium">
                              {project.name}
                            </TruncatedText>
                            {project.description ? (
                              <TruncatedText className="text-muted-foreground text-xs">
                                {project.description}
                              </TruncatedText>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    No projects yet.
                  </p>
                )}
              </div>
            </aside>

            {showCenterColumn ? (
              <section className="flex min-w-0 flex-col gap-6 pt-4 lg:pt-6">
                {resetSuccess ? (
                  <output className="block text-sm text-emerald-600">
                    Password updated. Sign in with your new password.
                  </output>
                ) : null}
                {accountClosed ? (
                  <output className="text-muted-foreground block max-w-md text-sm">
                    Your account has been deactivated. Contact an administrator
                    if you need access restored.
                  </output>
                ) : null}

                {hasFeed ? greeting : null}

                <HomeWipPanel items={wipItems} completion={completion} />
                <HomeNotificationsPanel notifications={unreadNotifications} />
              </section>
            ) : null}

            <aside className="min-w-0 pt-4 lg:pt-6">
              <HomeQuickLinksPanel role={role} layout="rail" />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
