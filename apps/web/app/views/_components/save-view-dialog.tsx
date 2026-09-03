'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
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
import { Textarea } from '@repo/ui/components/ui/textarea';
import { createSavedView } from '@/app/views/_services/saved-views.mutations.client';
import { emitSavedViewsChanged } from '@/app/views/_hooks/use-saved-views-nav';

type SaveViewDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- dialog open change callback
  readonly onOpenChange: (open: boolean) => void;
  readonly pathname: string;
  readonly search: string;
  readonly projectId?: string | null;
  readonly defaultTitle?: string;
};

export function SaveViewDialog({
  open,
  onOpenChange,
  pathname,
  search,
  projectId = null,
  defaultTitle = '',
}: Readonly<SaveViewDialogProps>) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(defaultTitle);
    setDescription('');
    setError(null);
  }, [defaultTitle, open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Title is required');
      return;
    }

    setPending(true);
    setError(null);
    try {
      await createSavedView({
        title: trimmed,
        description: description.trim() || null,
        pathname,
        search,
        projectId,
      });
      emitSavedViewsChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save view');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dismissOnOutsideClick={false}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription>
              Store this page and its filters so you can reopen them later.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="save-view-title">Title</Label>
              <Input
                id="save-view-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="save-view-description"
                className="flex items-center gap-1"
              >
                <span>Description</span>
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="save-view-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
            {error ? (
              <p className="text-destructive text-sm" role="alert">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
