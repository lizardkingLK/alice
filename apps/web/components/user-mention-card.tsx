'use client';

import Link from 'next/link';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  formatLabelFirstLetterCapitalized,
  getInitials,
} from '@/app/_shared/utility';

export type UserMentionCardProps = {
  readonly name?: string | null;
  readonly email?: string | null;
  readonly role?: string | null;
  readonly imageUrl?: string | null;
  /** When set, the card body links to this href (e.g. `/profile`). */
  readonly href?: string;
};

/** Presentational user summary used by header menu and @mention hover cards. */
export function UserMentionCard({
  name,
  email,
  role,
  imageUrl,
  href,
}: Readonly<UserMentionCardProps>) {
  const displayName = name?.trim() || email?.trim() || 'User';
  const roleLabel = role ? formatLabelFirstLetterCapitalized(role) : null;

  const body = (
    <div className="flex min-w-0 items-start gap-3">
      <Avatar className="size-9 shrink-0">
        {imageUrl ? <AvatarImage src={imageUrl} alt={displayName} /> : null}
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
        {email ? (
          <TruncatedText className="text-muted-foreground text-xs">
            {email}
          </TruncatedText>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="bg-muted/30 hover:bg-muted block rounded-lg p-2 transition-colors"
      >
        {body}
      </Link>
    );
  }

  return <div className="p-2">{body}</div>;
}
