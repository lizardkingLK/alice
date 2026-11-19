'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import type { Notification } from '@/app/notifications/_components/use-notifications-inbox';

export function AccessRequestNotificationDialog({
  notification,
  onClose,
  onAllow,
}: Readonly<{
  notification: Notification | null;
  onClose: () => void;
  onAllow: () => void;
}>) {
  return (
    <Dialog
      open={!!notification}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Access Request Details</DialogTitle>
          <DialogDescription>
            An outside domain user is requesting access to the system.
          </DialogDescription>
        </DialogHeader>
        <div className="bg-muted mt-2 max-h-75 overflow-y-auto rounded-md border p-4 font-mono text-xs whitespace-pre-wrap">
          {notification?.message}
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={onAllow}>
            Allow
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
