'use client';

import { getInitials } from '@/app/_shared/utility';
import type { WorkItemMemberLike } from '@/app/work-items/_helpers/work-item-member';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { SelectItem } from '@repo/ui/components/ui/select';
import { cn } from '@repo/ui/lib/utils';

type MemberSelectItemsProps = {
  readonly members: readonly WorkItemMemberLike[];
  readonly unassignedLabel?: string;
  readonly unassignedValue?: string;
  readonly itemClassName?: string;
};

export function MemberSelectItems({
  members,
  unassignedLabel = 'Unassigned',
  unassignedValue = 'unassigned',
  itemClassName,
}: Readonly<MemberSelectItemsProps>) {
  return (
    <>
      <SelectItem value={unassignedValue}>{unassignedLabel}</SelectItem>
      {members.map((member) => (
        <SelectItem key={member.id} value={member.id}>
          <div className={cn('flex items-center gap-2', itemClassName)}>
            <Avatar size="sm" className="size-5">
              {member.profile_picture ? (
                <AvatarImage src={member.profile_picture} alt={member.name} />
              ) : null}
              <AvatarFallback className="text-[8px]">
                {getInitials(member.name)}
              </AvatarFallback>
            </Avatar>
            <span>{member.name}</span>
          </div>
        </SelectItem>
      ))}
    </>
  );
}
