'use client';

import { DATABASE_BUSY_RETRY_TOAST } from '@repo/types';
import { toast } from '@repo/ui/components/ui/sonner';

/** Shared toast for apiFetch busy-DB retries (alice#562). */
export function notifyDatabaseBusyRetry(): void {
  toast.message(DATABASE_BUSY_RETRY_TOAST);
}
