'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Loader2 } from '@repo/ui/lib/icons';
import { getAccessAllowlistDisplayStatus } from '@repo/types';
import {
  updateAccessAllowlistEntry,
  type AccessAllowlistEntry,
  type AccessAllowlistStatus,
} from '@/app/access-allowlist/_services/access-allowlist.mutations.client';
import {
  toAllowlistDateInputValue,
  validateDomainRenewForGrant,
} from '@/lib/access-requests/grant-domain-renew';

type AccessRequestDomainRenewSectionProps = {
  readonly entry: AccessAllowlistEntry;
  readonly disabled?: boolean;
  // eslint-disable-next-line no-unused-vars -- callback docs
  readonly onRenewed: (updated: AccessAllowlistEntry) => void;
};

export function AccessRequestDomainRenewSection({
  entry,
  disabled = false,
  onRenewed,
}: Readonly<AccessRequestDomainRenewSectionProps>) {
  const displayStatus = getAccessAllowlistDisplayStatus(
    entry.status,
    entry.expires_at
  );

  const [label, setLabel] = useState(entry.label ?? '');
  const [status, setStatus] = useState<AccessAllowlistStatus>('active');
  const [expiresAt, setExpiresAt] = useState(
    toAllowlistDateInputValue(entry.expires_at)
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = () => {
    const validation = validateDomainRenewForGrant({
      status,
      expiresAtInput: expiresAt,
    });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsPending(true);
    setError(null);
    updateAccessAllowlistEntry(
      entry.id,
      {
        label: label.trim() || null,
        status,
        expires_at: validation.expiresAt,
      },
      entry.updated_at
    )
      .then((updated) => {
        onRenewed(updated);
      })
      .catch((renewError: unknown) => {
        const message =
          renewError instanceof Error
            ? renewError.message
            : 'Failed to update domain allowlist.';
        setError(message);
      })
      .finally(() => {
        setIsPending(false);
      });
  };

  return (
    <div className="space-y-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Renew domain allowlist</p>
        <p className="text-muted-foreground text-xs">
          This requester’s domain is currently{' '}
          <span className="font-medium capitalize">{displayStatus}</span>
          {'. '}
          Renew it before granting project access.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`grant-domain-value-${entry.id}`}>Domain</Label>
          <Input
            id={`grant-domain-value-${entry.id}`}
            value={entry.value}
            readOnly
            disabled
            className="bg-muted"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`grant-domain-label-${entry.id}`}>Label</Label>
          <Input
            id={`grant-domain-label-${entry.id}`}
            value={label}
            disabled={disabled || isPending}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Short name"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`grant-domain-status-${entry.id}`}>Status</Label>
          <Select
            value={status}
            onValueChange={(next) => setStatus(next as AccessAllowlistStatus)}
            disabled={disabled || isPending}
          >
            <SelectTrigger
              id={`grant-domain-status-${entry.id}`}
              className="w-full"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={`grant-domain-expires-${entry.id}`}>Expires on</Label>
          <Input
            id={`grant-domain-expires-${entry.id}`}
            type="date"
            value={expiresAt}
            disabled={disabled || isPending}
            onChange={(event) => setExpiresAt(event.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          className="cursor-pointer"
          disabled={disabled || isPending}
          onClick={handleSubmit}
        >
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Renewing…
            </>
          ) : (
            'Renew domain'
          )}
        </Button>
      </div>
    </div>
  );
}
