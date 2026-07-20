import {
  Briefcase,
  Building2,
  Clock,
  FileText,
  LayoutGrid,
  Mail,
  MapPin,
  Network,
  Phone,
} from '@repo/ui/lib/icons';
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
} from '@repo/ui/components/ui/avatar';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Separator } from '@repo/ui/components/ui/separator';
import { cn } from '@repo/ui/lib/utils';
import { PROFILE_MOCK } from '@/app/profile/_components/profile-mock-data';

const ABOUT_ICONS = {
  briefcase: Briefcase,
  network: Network,
  building: Building2,
  mapPin: MapPin,
  clock: Clock,
} as const;

const WORKED_ON_TONES = {
  blue: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
  orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  green: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
} as const;

export function ProfileView() {
  const profile = PROFILE_MOCK;

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
                <AvatarFallback className="bg-muted text-foreground text-2xl font-semibold sm:text-3xl">
                  {profile.avatarInitials}
                </AvatarFallback>
              </Avatar>

              <div className="space-y-0.5">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {profile.name}
                </h1>
                <p className="text-muted-foreground text-sm">
                  {profile.handle}
                </p>
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
                {profile.about.map((item) => {
                  const Icon = ABOUT_ICONS[item.icon];
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
                    <span className="text-foreground truncate">
                      {profile.email}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Phone className="size-4 shrink-0" />
                    <span className="text-foreground">{profile.phone}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2.5">
                <h2 className="text-muted-foreground text-[11px] font-semibold tracking-wider uppercase">
                  Teams
                </h2>
                <ul className="space-y-3">
                  {profile.teams.map((team) => (
                    <li key={team.id} className="flex items-center gap-2.5">
                      <Avatar size="sm">
                        <AvatarFallback className="text-[10px] font-semibold">
                          {team.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {team.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {team.membersLabel}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>

          {/* Right column */}
          <main className="min-w-0 space-y-8 pt-4 lg:pt-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold tracking-tight">
                  Worked on
                </h2>
                <Button
                  type="button"
                  variant="link"
                  className="text-primary h-auto cursor-pointer px-0"
                >
                  View all
                </Button>
              </div>

              <Card className="shadow-none">
                <CardContent className="divide-border divide-y p-0">
                  {profile.workedOn.map((item) => (
                    <div
                      key={item.id}
                      className="hover:bg-muted/40 flex items-start gap-3 px-4 py-3 transition-colors"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
                          WORKED_ON_TONES[item.tone]
                        )}
                      >
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium">
                          {item.title}
                        </p>
                        <p className="text-muted-foreground line-clamp-2 text-xs">
                          {item.meta}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="px-4 py-3">
                    <Button
                      type="button"
                      variant="link"
                      className="text-primary h-auto cursor-pointer px-0 text-sm"
                    >
                      Show more
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Places you work
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {profile.places.map((place) => (
                  <Card key={place.id} size="sm" className="shadow-none">
                    <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                      <LayoutGrid className="text-primary size-4" />
                      <CardTitle className="text-sm font-medium">
                        {place.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/50 flex items-center gap-3 rounded-lg border px-3 py-4">
                        <div
                          className={cn(
                            'flex size-10 items-center justify-center rounded-md',
                            'bg-primary text-white'
                          )}
                        >
                          <LayoutGrid className="size-5" />
                        </div>
                        <p className="text-sm font-medium">{place.subtitle}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">
                Works with
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {profile.worksWith.map((person) => (
                  <Card
                    key={person.id}
                    size="sm"
                    className="items-center py-5 text-center shadow-none"
                  >
                    <CardContent className="flex flex-col items-center gap-2 pt-0">
                      <Avatar className="size-16">
                        <AvatarFallback className="text-base font-semibold">
                          {person.initials}
                        </AvatarFallback>
                        {person.online ? (
                          <AvatarBadge className="ring-background size-3.5 bg-emerald-500" />
                        ) : null}
                      </Avatar>
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold">{person.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {person.handle}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {person.role}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
