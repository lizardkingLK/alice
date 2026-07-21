import Link from 'next/link';
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  FileText,
  LogIn,
  Mail,
  Phone,
  ShieldAlert,
  Users,
} from '@repo/ui/lib/icons';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Separator } from '@repo/ui/components/ui/separator';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  formatDate,
  formatLabelFirstLetterCapitalized,
  getInitials,
} from '@/app/_shared/utility';
import { WorkItemStatusBadge } from '@/app/work-items/_components/workItem-badge-status';
import type {
  ProfileTeam,
  ProfileWorkedOn,
} from '@/app/profile/_services/profile.service.server';

type ProfileViewProps = {
  name: string;
  handle: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: string;
  provider: string;
  emailVerified: boolean;
  memberSince: string | null;
  teams: ProfileTeam[];
  workedOn: ProfileWorkedOn[];
};

const ROLE_STYLES: Record<string, string> = {
  admin: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  manager:
    'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  member: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
};

const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email & password',
  google: 'Google',
};

function providerLabel(provider: string): string {
  return (
    PROVIDER_LABELS[provider] ?? formatLabelFirstLetterCapitalized(provider)
  );
}

export function ProfileView({
  name,
  handle,
  email,
  phone,
  avatarUrl,
  role,
  provider,
  emailVerified,
  memberSince,
  teams,
  workedOn,
}: Readonly<ProfileViewProps>) {
  const about = [
    {
      id: 'role',
      icon: Briefcase,
      label: `${formatLabelFirstLetterCapitalized(role)} role`,
    },
    {
      id: 'provider',
      icon: LogIn,
      label: `Signed in with ${providerLabel(provider)}`,
    },
    {
      id: 'verified',
      icon: emailVerified ? BadgeCheck : ShieldAlert,
      label: emailVerified ? 'Email verified' : 'Email not verified',
    },
    {
      id: 'member-since',
      icon: CalendarDays,
      label: `Member since ${formatDate(memberSince)}`,
    },
  ];

  return (
    <div className="bg-background min-h-full">
      {/* Banner */}
      <div
        className={cn(
          'relative h-40 w-full overflow-hidden sm:h-48 md:h-56',
          'bg-linear-to-br from-sky-700 via-teal-700 to-emerald-800'
        )}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.18),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,0,0,0.25),transparent_50%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/25 to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:gap-10">
          {/* Left column */}
          <aside className="relative z-10 -mt-12 space-y-5 sm:-mt-14">
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
                  {role}
                </Badge>
              </div>

              <Button
                type="button"
                variant="secondary"
                className="w-full cursor-pointer"
              >
                Manage your account
              </Button>
            </div>

            <Card size="sm" className="shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">About</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {about.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="flex items-start gap-2.5">
                      <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <p className="text-sm leading-snug">{item.label}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="space-y-4 pt-1">
              <div className="space-y-2.5">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Contact
                </h2>
                <div className="space-y-2">
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Mail className="size-4 shrink-0" />
                    <TruncatedText className="text-foreground">
                      {email}
                    </TruncatedText>
                  </div>
                  {phone ? (
                    <div className="text-muted-foreground flex items-center gap-2 text-sm">
                      <Phone className="size-4 shrink-0" />
                      <span className="text-foreground">{phone}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <Separator />

              <div className="space-y-2.5">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Teams
                </h2>
                {teams.length > 0 ? (
                  <ul className="space-y-3">
                    {teams.map((team) => (
                      <li key={team.id} className="flex items-center gap-2.5">
                        <Avatar size="sm">
                          <AvatarFallback className="text-[10px] font-semibold">
                            {getInitials(team.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <TruncatedText className="text-sm font-medium">
                            {team.name}
                          </TruncatedText>
                          <p className="text-muted-foreground truncate text-xs">
                            {team.memberCount}{' '}
                            {team.memberCount === 1 ? 'member' : 'members'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Not a member of any team yet.
                  </p>
                )}
              </div>
            </div>
          </aside>

          {/* Right column */}
          <main className="min-w-0 space-y-8 pt-4 lg:pt-6">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="text-muted-foreground size-5" />
                <h2 className="text-lg font-semibold tracking-tight">
                  Worked on
                </h2>
              </div>

              <Card className="shadow-none">
                <CardContent className="divide-border divide-y p-0">
                  {workedOn.length > 0 ? (
                    workedOn.map((item) => (
                      <Link
                        key={item.id}
                        href={`/work-items/${item.id}`}
                        className="hover:bg-muted/40 flex items-start gap-3 px-4 py-3 transition-colors"
                      >
                        <div className="bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md">
                          <FileText className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <TruncatedText className="text-sm font-medium">
                            {item.title}
                          </TruncatedText>
                          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                            {item.projectKey ? (
                              <span className="font-medium">
                                {item.projectKey}
                              </span>
                            ) : null}
                            <WorkItemStatusBadge status={item.status} />
                            <span>Updated {formatDate(item.updatedAt)}</span>
                          </div>
                        </div>
                      </Link>
                    ))
                  ) : (
                    <p className="text-muted-foreground px-4 py-6 text-sm">
                      No work items assigned or reported yet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
