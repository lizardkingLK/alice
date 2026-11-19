'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Loader2, ShieldCheck, ShieldX } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { toast } from '@repo/ui/components/ui/sonner';
import { AccessRequestDomainRenewSection } from '@/app/access-requests/_components/access-request-domain-renew-section';
import { AccessRequestGrantedRevokeSection } from '@/app/access-requests/_components/access-request-granted-revoke-section';
import { AccessRequestGrantProjectList } from '@/app/access-requests/_components/access-request-grant-project-list';
import type { AccessRequestEntry } from '@/app/access-requests/_services/access-requests.mutations.shared';
import {
  denyAccessRequestClient,
  grantAccessRequestClient,
  listSharedMembershipsClient,
  type SharedMembershipProject,
} from '@/app/access-requests/_services/access-requests.mutations.client';
import type { AccessAllowlistEntry } from '@/app/access-allowlist/_services/access-allowlist.mutations.client';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import { preventDismissForFloatingPortal } from '@/lib/dialog-outside-events';
import {
  isDomainEffectivelyActive,
  needsDomainRenewBeforeGrant,
} from '@/lib/access-requests/grant-domain-renew';
import {
  applyGrantToggle,
  applyMemberToggle,
  buildInitialGrantSelections,
  toGrantPayload,
  type GrantProjectSelection,
} from '@/lib/access-requests/grant-project-selection';

type AccessRequestGrantDialogProps = {
  readonly open: boolean;
  readonly entry: AccessRequestEntry;
  readonly projects: readonly Project[];
  readonly coveringDomainEntry?: AccessAllowlistEntry | null;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
};

function GrantPathHint({
  isDenied,
  memberLocked,
}: Readonly<{ isDenied: boolean; memberLocked: boolean }>) {
  return (
    <>
      {isDenied ? (
        <p className="text-muted-foreground text-xs">
          This request was denied earlier. Granting again will restore access
          for the selected projects.
        </p>
      ) : null}
      {memberLocked ? (
        <p className="text-muted-foreground text-xs">
          A covering domain allowlist is active for this email. Granting a
          project adds them as a project member (no email allowlist row).
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Grant writes an email allowlist ACL for selected projects. Member also
          adds them to the project roster when an Alice user already exists for
          this email.
        </p>
      )}
    </>
  );
}

function GrantDialogFooter({
  mode,
  isPending,
  membershipsLoading,
  projectsEmpty,
  onClose,
  onSave,
  onDenyGranted,
}: Readonly<{
  mode: 'granted' | 'grant' | 'renew';
  isPending: boolean;
  membershipsLoading: boolean;
  projectsEmpty: boolean;
  onClose: () => void;
  onSave: () => void;
  onDenyGranted: () => void;
}>) {
  if (mode === 'granted') {
    return (
      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="cursor-pointer"
          disabled={isPending || membershipsLoading}
          onClick={onDenyGranted}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Denying…
            </>
          ) : (
            <>
              <ShieldX className="size-4" />
              Deny
            </>
          )}
        </Button>
      </DialogFooter>
    );
  }

  if (mode === 'grant') {
    return (
      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          disabled={isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="button"
          className="cursor-pointer"
          disabled={isPending || projectsEmpty}
          onClick={onSave}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save'
          )}
        </Button>
      </DialogFooter>
    );
  }

  return (
    <DialogFooter>
      <Button
        type="button"
        variant="outline"
        className="cursor-pointer"
        disabled={isPending}
        onClick={onClose}
      >
        Cancel
      </Button>
    </DialogFooter>
  );
}

export function AccessRequestGrantDialog({
  open,
  entry,
  projects,
  coveringDomainEntry = null,
  onClose,
  onSuccess,
}: Readonly<AccessRequestGrantDialogProps>) {
  const isGranted = entry.status === 'granted';
  const canGrantProjects =
    entry.status === 'pending' || entry.status === 'denied';

  const initial = useMemo(
    () => buildInitialGrantSelections(entry.requested_project_keys, projects),
    [entry.requested_project_keys, projects]
  );

  const [selections, setSelections] = useState<GrantProjectSelection[]>(
    initial.selections
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [domainEntry, setDomainEntry] = useState<AccessAllowlistEntry | null>(
    coveringDomainEntry
  );
  const [domainRenewedInSession, setDomainRenewedInSession] = useState(false);
  const [sharedMemberships, setSharedMemberships] = useState<
    SharedMembershipProject[]
  >([]);
  const [membershipsLoading, setMembershipsLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelections(initial.selections);
    setError(null);
    setDomainEntry(coveringDomainEntry);
    setDomainRenewedInSession(false);
    setSharedMemberships([]);
  }, [open, entry.id, initial.selections, coveringDomainEntry]);

  useEffect(() => {
    if (!open || !isGranted) {
      return;
    }
    let cancelled = false;
    setMembershipsLoading(true);
    listSharedMembershipsClient(entry.id)
      .then((projectsList) => {
        if (!cancelled) {
          setSharedMemberships(projectsList);
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          const message =
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load shared memberships.';
          setError(message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMembershipsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, isGranted, entry.id]);

  const showRenewSection =
    canGrantProjects && needsDomainRenewBeforeGrant(domainEntry);
  const memberLocked = Boolean(
    domainEntry &&
    (isDomainEffectivelyActive(domainEntry) || domainRenewedInSession)
  );

  const handleGrantChange = (projectId: string, granted: boolean) => {
    setSelections((prev) =>
      prev.map((row) =>
        row.projectId === projectId ? applyGrantToggle(row, granted) : row
      )
    );
  };

  const handleMemberChange = (projectId: string, addMember: boolean) => {
    setSelections((prev) =>
      prev.map((row) =>
        row.projectId === projectId
          ? applyMemberToggle(row, addMember, { memberLocked })
          : row
      )
    );
  };

  const handleDomainRenewed = (updated: AccessAllowlistEntry) => {
    setDomainEntry(updated);
    setDomainRenewedInSession(true);
    toast.success('Domain allowlist renewed.', {
      description: `${updated.value} is active again. Continue with project grant.`,
    });
  };

  const handleSave = () => {
    if (!canGrantProjects) {
      return;
    }
    if (showRenewSection) {
      setError('Renew the domain allowlist before granting access.');
      return;
    }

    const payload = toGrantPayload(selections);
    if (payload.length === 0) {
      setError('Select at least one project to grant.');
      return;
    }

    setIsPending(true);
    setError(null);
    grantAccessRequestClient(entry.id, { projects: payload })
      .then(() => {
        onSuccess();
      })
      .catch((grantError: unknown) => {
        const message =
          grantError instanceof Error
            ? grantError.message
            : 'Failed to grant access request.';
        setError(message);
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  const handleDenyGranted = () => {
    setIsPending(true);
    setError(null);
    denyAccessRequestClient(entry.id)
      .then(() => {
        toast.success('Access request denied.', {
          description:
            sharedMemberships.length > 0
              ? 'Shared project memberships were removed and any email allowlist for this address was deactivated.'
              : 'The request is now denied.',
        });
        onSuccess();
      })
      .catch((denyError: unknown) => {
        const message =
          denyError instanceof Error
            ? denyError.message
            : 'Failed to deny access request.';
        setError(message);
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  let footerMode: 'granted' | 'grant' | 'renew' = 'grant';
  if (isGranted) {
    footerMode = 'granted';
  } else if (showRenewSection) {
    footerMode = 'renew';
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !isPending) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="sm:max-w-lg"
        onPointerDownOutside={preventDismissForFloatingPortal}
        onInteractOutside={preventDismissForFloatingPortal}
        onFocusOutside={preventDismissForFloatingPortal}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-5 shrink-0" />
            {isGranted ? 'Edit granted access' : 'Grant access'}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-sm">
              <TruncatedText className="text-foreground font-semibold">
                {entry.requester_email}
              </TruncatedText>
              {entry.requester_name ? (
                <TruncatedText className="text-muted-foreground text-xs">
                  {entry.requester_name}
                </TruncatedText>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {canGrantProjects && initial.omittedRequestedKeys.length > 0 ? (
            <p className="text-muted-foreground text-xs">
              Requested keys you cannot access were omitted:{' '}
              <span className="font-mono">
                {initial.omittedRequestedKeys.join(', ')}
              </span>
              {'.'}
            </p>
          ) : null}

          <div className="bg-muted max-h-36 overflow-y-auto rounded-md border p-3 font-mono text-xs whitespace-pre-wrap">
            {entry.message}
          </div>

          {isGranted ? (
            <AccessRequestGrantedRevokeSection
              membershipsLoading={membershipsLoading}
              sharedMemberships={sharedMemberships}
            />
          ) : null}

          {showRenewSection && domainEntry ? (
            <AccessRequestDomainRenewSection
              entry={domainEntry}
              disabled={isPending}
              onRenewed={handleDomainRenewed}
            />
          ) : null}

          {canGrantProjects && !showRenewSection ? (
            <>
              <GrantPathHint
                isDenied={entry.status === 'denied'}
                memberLocked={memberLocked}
              />
              <AccessRequestGrantProjectList
                entryId={entry.id}
                projects={projects}
                selections={selections}
                memberLocked={memberLocked}
                isPending={isPending}
                onGrantChange={handleGrantChange}
                onMemberChange={handleMemberChange}
              />
            </>
          ) : null}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <GrantDialogFooter
          mode={footerMode}
          isPending={isPending}
          membershipsLoading={membershipsLoading}
          projectsEmpty={projects.length === 0}
          onClose={onClose}
          onSave={handleSave}
          onDenyGranted={handleDenyGranted}
        />
      </DialogContent>
    </Dialog>
  );
}
