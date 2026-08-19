'use client';

import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { signOut } from '@/app/auth/actions';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { User } from '@repo/ui/lib/icons';
import Image from 'next/image';
import { cn } from '@repo/ui/lib/utils';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import {
  formatLabelFirstLetterCapitalized,
  getInitials,
} from '@/app/_shared/utility';
import { Badge } from '@repo/ui/components/ui/badge';

type AuthControlsProps = {
  email?: string | null;
  name?: string | null;
  role?: string | null;
  /** Avatar URL from `public.users.profile_picture` (not Auth metadata). */
  profilePicture?: string | null;
};

type UserProfileProps = {
  email: string;
  name?: string | null;
  role?: string | null;
  image?: string | null;
};

const UserProfile = ({
  email,
  name,
  role,
  image,
}: Readonly<UserProfileProps>) => {
  const displayName = name?.trim() || email;
  const roleLabel = role ? formatLabelFirstLetterCapitalized(role) : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn(image ? 'rounded-full' : '', 'cursor-pointer')}
        >
          {image ? (
            <Image
              alt="profile_picture"
              src={image}
              width={50}
              height={50}
              className="rounded-full"
            />
          ) : (
            <User />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem
          asChild
          className="bg-muted/30 hover:bg-muted h-auto cursor-pointer p-2"
        >
          <Link
            href="/profile"
            className="flex min-w-0 items-start gap-3 rounded-lg"
          >
            <Avatar className="size-9 shrink-0">
              {image ? <AvatarImage src={image} alt={displayName} /> : null}
              <AvatarFallback className="text-xs font-semibold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex min-w-0 items-center gap-2">
                <TruncatedText className="min-w-0 flex-1 text-sm font-medium">
                  {displayName}
                </TruncatedText>
                {roleLabel ? (
                  <Badge variant="outline" className="shrink-0 font-normal">
                    {roleLabel}
                  </Badge>
                ) : null}
              </div>
              <TruncatedText className="text-muted-foreground text-xs">
                {email}
              </TruncatedText>
            </div>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="justify-center">
          <form action={signOut} className="w-full">
            <PendingSubmitButton
              variant="ghost"
              loadingLabel="Signing out..."
              className="w-full justify-center"
            >
              Sign Out
            </PendingSubmitButton>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export function AuthControls({
  email,
  name,
  role,
  profilePicture,
}: Readonly<AuthControlsProps>) {
  if (email) {
    return (
      <section className="flex items-center gap-4">
        <UserProfile
          email={email}
          name={name}
          role={role}
          image={profilePicture}
        />
      </section>
    );
  }

  return (
    <section className="flex gap-4">
      <Button variant="outline" asChild className="cursor-pointer">
        <Link href="/login">Sign In</Link>
      </Button>
      <Button asChild className="cursor-pointer">
        <Link href="/signup">Sign Up</Link>
      </Button>
    </section>
  );
}
