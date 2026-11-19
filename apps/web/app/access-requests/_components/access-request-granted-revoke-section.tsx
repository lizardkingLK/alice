'use client';

import { Loader2 } from '@repo/ui/lib/icons';
import { AccessRequestProjectKeyBadges } from '@/app/access-requests/_components/access-request-project-key-badges';
import type { SharedMembershipProject } from '@/app/access-requests/_services/access-requests.mutations.client';

type AccessRequestGrantedRevokeSectionProps = {
  readonly membershipsLoading: boolean;
  readonly sharedMemberships: readonly SharedMembershipProject[];
};

export function AccessRequestGrantedRevokeSection({
  membershipsLoading,
  sharedMemberships,
}: Readonly<AccessRequestGrantedRevokeSectionProps>) {
  return (
    <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-sm font-semibold">Revoke on deny</p>
      <p className="text-muted-foreground text-xs">
        Denying this granted request removes project memberships you can access
        for this person and deactivates their email allowlist row (if any).
        Domain allowlist rows are not changed.
      </p>
      {membershipsLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="size-3.5 animate-spin" />
          Loading shared memberships…
        </div>
      ) : null}
      {!membershipsLoading && sharedMemberships.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          No shared project memberships found for projects you can access. Deny
          will still mark the request denied and deactivate any email allowlist
          entry.
        </p>
      ) : null}
      {!membershipsLoading && sharedMemberships.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {sharedMemberships.map((project) => (
            <AccessRequestProjectKeyBadges
              key={project.id}
              keys={[project.key]}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
