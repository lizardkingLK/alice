'use client';

import { FormCancelSubmitActions } from '@/components/form-cancel-submit-actions';
import { ProjectCheckboxList } from '@/components/project-checkbox-list';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Loader2, Shield, X } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { InfoTooltip } from '@repo/ui/components/ui/info-tooltip';
import {
  accessAllowlistDomainValueSchema,
  accessAllowlistEmailValueSchema,
  EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE,
  isActorOwnAllowlistDomain,
  OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE,
} from '@repo/types';
import {
  createAccessAllowlistEntry,
  updateAccessAllowlistEntry,
  type AccessAllowlistEntry,
  type AccessAllowlistKind,
  type AccessAllowlistStatus,
} from '@/app/access-allowlist/_services/access-allowlist.mutations.client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import { cn } from '@repo/ui/lib/utils';

const ALLOWLIST_PROJECTS_TOOLTIP =
  'Select at least one project. These control which project workspaces the guest can open. Add the user under Project → Members separately for operational access (assignments, teams, capacity).';

interface AccessAllowlistFormProps {
  readonly entry?: AccessAllowlistEntry;
  readonly currentUserEmail?: string | null;
  readonly projects?: readonly Project[];
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly initialKind?: AccessAllowlistKind;
  readonly initialValue?: string;
  readonly className?: string;
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function validateAllowlistValue(
  kind: AccessAllowlistKind,
  rawValue: string
): { ok: true; value: string } | { ok: false; message: string } {
  const schema =
    kind === 'domain'
      ? accessAllowlistDomainValueSchema
      : accessAllowlistEmailValueSchema;
  const parsed = schema.safeParse(rawValue);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? 'Invalid value.',
    };
  }
  return { ok: true, value: parsed.data };
}

function initialSelectedProjectKeys(
  entry: AccessAllowlistEntry | undefined
): string[] {
  if (
    !entry?.allowed_project_ids ||
    !Array.isArray(entry.allowed_project_ids)
  ) {
    return [];
  }
  return entry.allowed_project_ids.map(String).filter(Boolean);
}

type AllowlistSubmitValidation =
  | { ok: false; message: string }
  | { ok: true; validatedValue: string | null; parsedAcl: string[] | null };

function validateAllowlistSubmit(params: {
  readonly isEdit: boolean;
  readonly kind: AccessAllowlistKind;
  readonly value: string;
  readonly selectedProjectKeys: readonly string[];
}): AllowlistSubmitValidation {
  let validatedValue: string | null = null;
  if (!params.isEdit) {
    const validated = validateAllowlistValue(params.kind, params.value);
    if (!validated.ok) {
      return { ok: false, message: validated.message };
    }
    validatedValue = validated.value;
  }

  let parsedAcl: string[] | null = null;
  if (params.kind === 'email') {
    if (params.selectedProjectKeys.length === 0) {
      return { ok: false, message: 'Select at least one allowed project.' };
    }
    parsedAcl = [...params.selectedProjectKeys];
  }

  return { ok: true, validatedValue, parsedAcl };
}

export function AccessAllowlistForm({
  entry,
  currentUserEmail = null,
  projects = [],
  onClose,
  onSuccess,
  initialKind,
  initialValue,
  className,
}: Readonly<AccessAllowlistFormProps>) {
  const isEdit = Boolean(entry);
  const lockOwnDomainStatus = Boolean(
    entry && isActorOwnAllowlistDomain(entry, currentUserEmail)
  );
  const { handleMutationError } = useOptimisticLock();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [domainConflictOpen, setDomainConflictOpen] = useState(false);

  const [kind, setKind] = useState<AccessAllowlistKind>(
    entry?.kind ?? initialKind ?? 'domain'
  );
  const [value, setValue] = useState(entry?.value ?? initialValue ?? '');
  const [label, setLabel] = useState(entry?.label ?? '');
  const [expiresAt, setExpiresAt] = useState(
    toDateInputValue(entry?.expires_at ?? null)
  );
  const [status, setStatus] = useState<AccessAllowlistStatus>(
    entry?.status ?? 'active'
  );
  const [selectedProjectKeys, setSelectedProjectKeys] = useState<string[]>(() =>
    initialSelectedProjectKeys(entry)
  );

  const projectCheckboxOptions = useMemo(
    () =>
      projects.map((project) => ({
        key: project.key,
        name: project.name,
      })),
    [projects]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      const validation = validateAllowlistSubmit({
        isEdit,
        kind,
        value,
        selectedProjectKeys,
      });
      if (!validation.ok) {
        setMessage(validation.message);
        setIsError(true);
        return;
      }

      const { validatedValue, parsedAcl } = validation;

      if (isEdit && entry) {
        const pendingFields = {
          label: label.trim() || null,
          expires_at: fromDateInputValue(expiresAt),
          allowed_project_ids: parsedAcl,
          status,
        };

        const updated = await runLockedMutationOrThrow({
          mutate: () =>
            updateAccessAllowlistEntry(
              entry.id,
              pendingFields,
              entry.updated_at
            ),
          handleMutationError,
          entityType: 'access_allowlist',
          entityId: entry.id,
          expectedUpdatedAt: entry.updated_at,
          pendingFields,
        });
        if (!updated) {
          return;
        }
        setMessage('Allowlist entry updated.');
      } else {
        await createAccessAllowlistEntry({
          kind,
          value: validatedValue ?? value,
          label: label.trim() || null,
          expires_at: fromDateInputValue(expiresAt),
          allowed_project_ids: parsedAcl,
          status,
        });
        setMessage('Allowlist entry created.');
      }
      setIsSuccess(true);
    } catch (error) {
      const modeText = isEdit ? 'update' : 'create';
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${modeText} allowlist entry.`;
      if (errorMessage === EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE) {
        setDomainConflictOpen(true);
        return;
      }
      setMessage(errorMessage);
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isSuccess) return;
    const timer = setTimeout(() => {
      onSuccess?.();
    }, 1200);
    return () => clearTimeout(timer);
  }, [isSuccess, onSuccess]);

  let submitButtonText;
  if (isSubmitting) {
    submitButtonText = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isEdit ? 'Saving…' : 'Adding…'}
      </>
    );
  } else if (isEdit) {
    submitButtonText = 'Save Changes';
  } else {
    submitButtonText = 'Add Entry';
  }

  return (
    <>
      <Card
        className={cn(
          'relative flex max-h-[85vh] flex-col overflow-hidden border border-gray-200 bg-white text-gray-900 shadow-xl transition-all duration-300 hover:shadow-2xl',
          className
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 cursor-pointer"
          aria-label="Close"
        >
          <X className="size-4" />
        </Button>
        <CardHeader className="shrink-0">
          <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Shield className="text-primary size-5" />
            {isEdit ? 'Edit allowlist entry' : 'Add allowlist entry'}
          </CardTitle>
          <CardDescription>
            Approve a company domain or a specific email for app admission.
            Adding an email sends that person an invite (or a sign-in link if
            they already have an account). Domain rows do not send mail.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col justify-between overflow-hidden"
          >
            <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex h-6 items-center gap-1">
                    <Label htmlFor="allowlist-kind">Kind</Label>
                  </div>
                  <Select
                    value={kind}
                    onValueChange={(next) =>
                      setKind(next as AccessAllowlistKind)
                    }
                    disabled={isEdit || isSubmitting || isSuccess}
                  >
                    <SelectTrigger id="allowlist-kind" className="w-full">
                      <SelectValue placeholder="Select kind" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="domain">Domain</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex h-6 items-center gap-1">
                    <Label htmlFor="allowlist-status">Status</Label>
                    {lockOwnDomainStatus ? (
                      <InfoTooltip
                        ariaLabel={OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE}
                      >
                        {OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE}
                      </InfoTooltip>
                    ) : null}
                  </div>
                  <Select
                    value={status}
                    onValueChange={(next) =>
                      setStatus(next as AccessAllowlistStatus)
                    }
                    disabled={isSubmitting || isSuccess || lockOwnDomainStatus}
                  >
                    <SelectTrigger id="allowlist-status" className="w-full">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowlist-value">
                  {kind === 'domain' ? 'Domain' : 'Email'}
                </Label>
                <Input
                  id="allowlist-value"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  placeholder={
                    kind === 'domain' ? 'acme.com' : 'client@partner.com'
                  }
                  disabled={isEdit || isSubmitting || isSuccess}
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowlist-label">Label (optional)</Label>
                <Input
                  id="allowlist-label"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="e.g. Acme corp, Pilot client"
                  disabled={isSubmitting || isSuccess}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="allowlist-expires">Expires on (optional)</Label>
                <Input
                  id="allowlist-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  disabled={isSubmitting || isSuccess}
                />
              </div>

              {kind === 'email' ? (
                <div className="space-y-2">
                  <div className="flex h-6 items-center gap-1">
                    <Label>Allowed projects</Label>
                    <InfoTooltip ariaLabel={ALLOWLIST_PROJECTS_TOOLTIP}>
                      {ALLOWLIST_PROJECTS_TOOLTIP}
                    </InfoTooltip>
                  </div>
                  <ProjectCheckboxList
                    projects={projectCheckboxOptions}
                    selectedKeys={selectedProjectKeys}
                    onSelectedKeysChange={setSelectedProjectKeys}
                    disabled={isSubmitting || isSuccess}
                    emptyText="No projects available. Create a project first."
                    listClassName="no-scrollbar"
                  />
                </div>
              ) : null}
            </div>

            <div className="shrink-0 pt-4">
              <FormCancelSubmitActions
                message={message}
                isError={isError}
                isBusy={isSubmitting || isSuccess}
                onCancel={onClose}
                submitLabel={submitButtonText}
              />
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={domainConflictOpen} onOpenChange={setDomainConflictOpen}>
        <DialogContent className="bg-card border-border/80 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Access denied</DialogTitle>
            <DialogDescription>
              {EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={() => setDomainConflictOpen(false)}
            >
              Okay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
