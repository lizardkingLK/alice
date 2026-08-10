'use client';

import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { cn } from '@repo/ui/lib/utils';

export type MemberCheckboxOption = {
  readonly userId: string;
  readonly name: string;
  readonly email?: string;
  readonly role?: string;
};

type MemberCheckboxListProps = {
  readonly members: readonly MemberCheckboxOption[];
  readonly selectedUserIds: readonly string[];
  // eslint-disable-next-line no-unused-vars -- selection change callback
  readonly onSelectedUserIdsChange: (userIds: string[]) => void;
  readonly emptyText?: string;
  readonly checkboxIdPrefix?: string;
  readonly disabled?: boolean;
  readonly excludeUserIds?: readonly string[];
  readonly listClassName?: string;
};

export function MemberCheckboxList({
  members,
  selectedUserIds,
  onSelectedUserIdsChange,
  emptyText = 'No active members found in this project.',
  checkboxIdPrefix = 'member-checkbox',
  disabled = false,
  excludeUserIds,
  listClassName,
}: Readonly<MemberCheckboxListProps>) {
  const excluded = excludeUserIds?.length ? new Set(excludeUserIds) : null;
  const visibleMembers = excluded
    ? members.filter((member) => !excluded.has(member.userId))
    : members;

  if (visibleMembers.length === 0) {
    return (
      <div className="text-muted-foreground bg-muted/30 border-border/50 rounded-lg border p-3 text-xs">
        {emptyText}
      </div>
    );
  }

  const toggleUser = (userId: string, checked: boolean) => {
    if (checked) {
      if (selectedUserIds.includes(userId)) {
        return;
      }
      onSelectedUserIdsChange([...selectedUserIds, userId]);
      return;
    }
    onSelectedUserIdsChange(selectedUserIds.filter((id) => id !== userId));
  };

  return (
    <div
      className={cn(
        'bg-background/50 border-input custom-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border p-2',
        listClassName
      )}
    >
      {visibleMembers.map((member) => {
        const checked = selectedUserIds.includes(member.userId);
        const checkboxId = `${checkboxIdPrefix}-${member.userId}`;
        const meta = [member.email, member.role].filter(Boolean).join(' • ');
        return (
          <div
            key={member.userId}
            className="hover:bg-accent/50 flex items-center gap-3 rounded px-2.5 py-1.5 transition-colors"
          >
            <Checkbox
              id={checkboxId}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) =>
                toggleUser(member.userId, value === true)
              }
              className="cursor-pointer"
            />
            <label
              htmlFor={checkboxId}
              className="flex flex-1 cursor-pointer flex-col"
            >
              <span className="text-foreground text-xs font-semibold">
                {member.name}
              </span>
              {meta ? (
                <span className="text-muted-foreground text-[10px]">
                  {meta}
                </span>
              ) : null}
            </label>
          </div>
        );
      })}
    </div>
  );
}
