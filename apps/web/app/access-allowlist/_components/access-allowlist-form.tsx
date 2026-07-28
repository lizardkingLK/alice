'use client';

import { FormCancelSubmitActions } from '@/components/form-cancel-submit-actions';
import { FormEvent, useEffect, useState } from 'react';
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
  accessAllowlistDomainValueSchema,
  accessAllowlistEmailValueSchema,
} from '@repo/types';
import {
  createAccessAllowlistEntry,
  updateAccessAllowlistEntry,
  type AccessAllowlistEntry,
  type AccessAllowlistKind,
  type AccessAllowlistStatus,
} from '@/app/access-allowlist/_services/accessAllowlist.service';

interface AccessAllowlistFormProps {
  readonly entry?: AccessAllowlistEntry;
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
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

export function AccessAllowlistForm({
  entry,
  onClose,
  onSuccess,
}: Readonly<AccessAllowlistFormProps>) {
  const isEdit = Boolean(entry);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [kind, setKind] = useState<AccessAllowlistKind>(
    entry?.kind ?? 'domain'
  );
  const [value, setValue] = useState(entry?.value ?? '');
  const [label, setLabel] = useState(entry?.label ?? '');
  const [expiresAt, setExpiresAt] = useState(
    toDateInputValue(entry?.expires_at ?? null)
  );
  const [status, setStatus] = useState<AccessAllowlistStatus>(
    entry?.status ?? 'active'
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    try {
      if (isEdit && entry) {
        await updateAccessAllowlistEntry(entry.id, {
          label: label.trim() || null,
          expires_at: fromDateInputValue(expiresAt),
          status,
        });
        setMessage('Allowlist entry updated.');
      } else {
        const validated = validateAllowlistValue(kind, value);
        if (!validated.ok) {
          setMessage(validated.message);
          setIsError(true);
          return;
        }

        await createAccessAllowlistEntry({
          kind,
          value: validated.value,
          label: label.trim() || null,
          expires_at: fromDateInputValue(expiresAt),
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
    <Card className="relative border border-gray-200 bg-white text-gray-900 shadow-xl transition-all duration-300 hover:shadow-2xl">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        className="absolute top-3 right-3 cursor-pointer"
        aria-label="Close"
      >
        <X className="size-4" />
      </Button>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Shield className="text-primary size-5" />
          {isEdit ? 'Edit allowlist entry' : 'Add allowlist entry'}
        </CardTitle>
        <CardDescription>
          Approve a company domain or a specific email for app admission.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="allowlist-kind">Kind</Label>
              <Select
                value={kind}
                onValueChange={(next) => setKind(next as AccessAllowlistKind)}
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
              <Label htmlFor="allowlist-status">Status</Label>
              <Select
                value={status}
                onValueChange={(next) =>
                  setStatus(next as AccessAllowlistStatus)
                }
                disabled={isSubmitting || isSuccess}
              >
                <SelectTrigger id="allowlist-status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
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

          <FormCancelSubmitActions
            message={message}
            isError={isError}
            isBusy={isSubmitting || isSuccess}
            onCancel={onClose}
            submitLabel={submitButtonText}
          />
        </form>
      </CardContent>
    </Card>
  );
}
