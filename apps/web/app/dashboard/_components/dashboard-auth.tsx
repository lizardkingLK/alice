'use client';

import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { signOut } from '@/app/auth/actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { User } from '@repo/ui/lib/icons';
import Image from 'next/image';
import { cn } from '@repo/ui/lib/utils';
import { PendingSubmitButton } from '@/components/pending-submit-button';
import { UserMentionCard } from '@/components/user-mention-card';

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
      <DropdownMenuContent align="end" className="w-72 p-1">
        <UserMentionCard
          name={name}
          email={email}
          role={role}
          imageUrl={image}
          href="/profile"
        />
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
