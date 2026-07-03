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

type AuthControlsProps = {
  email?: string | null;
};

const UserProfile = () => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <User />
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

export function AuthControls({ email }: Readonly<AuthControlsProps>) {
  if (email) {
    return (
      <section className="flex items-center gap-4">
        <UserProfile />
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
