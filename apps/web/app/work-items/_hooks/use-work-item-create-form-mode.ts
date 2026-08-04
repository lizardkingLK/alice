'use client';

import { useEffect, useState } from 'react';
import {
  readWorkItemCreateFormMode,
  WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT,
  type WorkItemCreateFormMode,
} from '@/app/work-items/_helpers/work-item-create-form-preference';

/**
 * Live create-form layout preference (classic | modern) from localStorage.
 */
export function useWorkItemCreateFormMode(): WorkItemCreateFormMode {
  const [mode, setMode] = useState<WorkItemCreateFormMode>('classic');

  useEffect(() => {
    const refresh = () => {
      setMode(readWorkItemCreateFormMode());
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener(WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT, refresh);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener(
        WORK_ITEM_CREATE_FORM_MODE_CHANGED_EVENT,
        refresh
      );
    };
  }, []);

  return mode;
}
