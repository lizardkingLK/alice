'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  ChartsDescriptionField,
  useChartsAliceDescriptionSuggest,
} from '@/app/charts/_components/charts-description-field';

export type ChartsSaveWorkspacePayload = {
  readonly title: string;
  readonly description: string | null;
  readonly isOverview: boolean;
};

type ChartsSaveWorkspaceDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  readonly defaultTitle: string;
  readonly defaultDescription?: string | null;
  readonly initialIsOverview?: boolean;
  /** Create a new workspace vs rename/save the current one. */
  readonly mode?: 'create' | 'save';
  /** Optional board summary for Alice suggest (widget list, etc.). */
  readonly aliceContext?: unknown;
  readonly onSave: (
    // eslint-disable-next-line no-unused-vars
    payload: ChartsSaveWorkspacePayload
  ) => void | Promise<void>;
};

export function ChartsSaveWorkspaceDialog({
  open,
  onOpenChange,
  defaultTitle,
  defaultDescription = null,
  initialIsOverview = false,
  mode = 'save',
  aliceContext,
  onSave,
}: Readonly<ChartsSaveWorkspaceDialogProps>) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription ?? '');
  const [isOverview, setIsOverview] = useState(initialIsOverview);
  const [pending, setPending] = useState(false);
  const { suggesting, suggestError, suggest, resetSuggestError } =
    useChartsAliceDescriptionSuggest({
      scope: 'workspace',
      title,
      description,
      onDescriptionChange: setDescription,
      context: aliceContext,
    });
  const isCreate = mode === 'create';
  const confirmLabel = (() => {
    if (pending) {
      return isCreate ? 'Creating…' : 'Saving…';
    }
    return isCreate ? 'Create' : 'Save';
  })();

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(defaultTitle);
    setDescription(defaultDescription ?? '');
    setIsOverview(initialIsOverview);
    setPending(false);
    resetSuggestError();
  }, [
    open,
    defaultTitle,
    defaultDescription,
    initialIsOverview,
    resetSuggestError,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending || suggesting) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'New workspace' : 'Save option'}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Name the new chart workspace and optionally add a description.'
              : 'Update the name and description for this chart workspace.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="chart-workspace-title">Name</Label>
            <Input
              id="chart-workspace-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Charts"
              autoFocus
              disabled={pending || suggesting}
            />
          </div>
          <ChartsDescriptionField
            id="chart-workspace-description"
            value={description}
            onChange={setDescription}
            title={title}
            suggesting={suggesting}
            suggestError={suggestError}
            onSuggest={() => void suggest()}
            placeholder="What this workspace is for…"
            disabled={pending}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isOverview}
              disabled={pending || suggesting}
              onCheckedChange={(checked) => setIsOverview(checked === true)}
            />
            Mark as overview
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={pending || suggesting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!title.trim() || pending || suggesting}
            onClick={() => {
              void (async () => {
                setPending(true);
                try {
                  await onSave({
                    title: title.trim(),
                    description: description.trim() || null,
                    isOverview,
                  });
                  onOpenChange(false);
                } catch {
                  setPending(false);
                }
              })();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
