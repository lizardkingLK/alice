'use client';

import { useMemo, useState } from 'react';
import type {
  WorkflowResolutionPayload,
  WorkflowResolutionPreset,
} from '@repo/types/api/v1';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-details/work-item-action-dialog';

type WorkItemResolutionDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onOpenChange: (open: boolean) => void;
  readonly preset: WorkflowResolutionPreset;
  readonly targetStatusLabel: string;
  readonly isPending: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onSubmit: (payload: WorkflowResolutionPayload) => void;
};

export function WorkItemResolutionDialog({
  open,
  onOpenChange,
  preset,
  targetStatusLabel,
  isPending,
  onSubmit,
}: WorkItemResolutionDialogProps) {
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [outcomeId, setOutcomeId] = useState<string | null>(
    preset.outcomes[0]?.id ?? null
  );

  const canSubmit = useMemo(() => {
    if (preset.outcomes.length > 0 && !outcomeId) {
      return false;
    }
    return preset.fields.every((field) => {
      if (!field.required) {
        return true;
      }
      const value = answers[field.id];
      if (field.type === 'checkbox') {
        return value === true || value === false;
      }
      return typeof value === 'string' && value.trim().length > 0;
    });
  }, [answers, outcomeId, preset]);

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={preset.title}
      description={`Complete this form to move to ${targetStatusLabel}.`}
      isPending={isPending}
      submitLabel="Continue"
      submitDisabled={!canSubmit}
      onSubmit={() => {
        onSubmit({
          presetId: preset.id,
          outcomeId,
          answers: preset.fields.map((field) => ({
            fieldId: field.id,
            value: answers[field.id] ?? null,
          })),
        });
      }}
    >
      <div className="space-y-3" data-testid="work-item-resolution-dialog">
        {preset.fields.map((field) => (
          <div key={field.id} className="space-y-1.5">
            <Label htmlFor={`resolution-${field.id}`}>
              {field.label}
              {field.required ? ' *' : ''}
            </Label>
            {field.type === 'text' ? (
              <Input
                id={`resolution-${field.id}`}
                value={
                  typeof answers[field.id] === 'string'
                    ? (answers[field.id] as string)
                    : ''
                }
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [field.id]: event.target.value,
                  }))
                }
              />
            ) : null}
            {field.type === 'textarea' ? (
              <Textarea
                id={`resolution-${field.id}`}
                value={
                  typeof answers[field.id] === 'string'
                    ? (answers[field.id] as string)
                    : ''
                }
                onChange={(event) =>
                  setAnswers((current) => ({
                    ...current,
                    [field.id]: event.target.value,
                  }))
                }
              />
            ) : null}
            {field.type === 'select' ? (
              <Select
                value={
                  typeof answers[field.id] === 'string'
                    ? (answers[field.id] as string)
                    : undefined
                }
                onValueChange={(value) => {
                  if (!value) return;
                  setAnswers((current) => ({
                    ...current,
                    [field.id]: value,
                  }));
                }}
              >
                <SelectTrigger id={`resolution-${field.id}`}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(field.options ?? []).map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {field.type === 'checkbox' ? (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`resolution-${field.id}`}
                  checked={answers[field.id] === true}
                  onCheckedChange={(checked) =>
                    setAnswers((current) => ({
                      ...current,
                      [field.id]: checked === true,
                    }))
                  }
                />
                <span>{field.label}</span>
              </label>
            ) : null}
          </div>
        ))}
        {preset.outcomes.length > 0 ? (
          <div className="space-y-1.5">
            <Label htmlFor="resolution-outcome">Outcome *</Label>
            <Select
              value={outcomeId ?? undefined}
              onValueChange={(value) => setOutcomeId(value)}
            >
              <SelectTrigger id="resolution-outcome">
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                {preset.outcomes.map((outcome) => (
                  <SelectItem key={outcome.id} value={outcome.id}>
                    {outcome.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>
    </WorkItemActionDialog>
  );
}
