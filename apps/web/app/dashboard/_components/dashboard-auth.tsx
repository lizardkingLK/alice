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
import { Book, User, UserIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@repo/ui/lib/utils';

type AuthControlsProps = {
  email?: string | null;
  meta?: { avatar_url?: string };
};

type UserProfileProps = {
  image?: string;
};

const UserProfile = ({ image }: Readonly<UserProfileProps>) => {
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
      <DropdownMenuContent>
        <DropdownMenuItem>
          <UserIcon />
          Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Book />
          Docs
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <form action={signOut}>
            <Button type="submit" variant="ghost" className="cursor-pointer">
              Sign Out
            </Button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export function AuthControls({ email, meta }: Readonly<AuthControlsProps>) {
  if (email) {
    return (
      <section className="flex items-center gap-4">
        <UserProfile image={meta?.avatar_url} />
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
