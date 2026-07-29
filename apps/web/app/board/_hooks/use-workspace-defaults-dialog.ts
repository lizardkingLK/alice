'use client';

import { useCallback, useState } from 'react';
import {
  writeBoardDefaults,
  type BoardDefaultsPreference,
} from '@/app/board/_helpers/board-defaults-storage';

type UseWorkspaceDefaultsDialogOptions = {
  readonly userId: string | null;
  // eslint-disable-next-line no-unused-vars -- save callback signature
  readonly onSave?: (preference: BoardDefaultsPreference) => void;
};

export function useWorkspaceDefaultsDialog({
  userId,
  onSave,
}: UseWorkspaceDefaultsDialogOptions) {
  const [defaultsDialogOpen, setDefaultsDialogOpen] = useState(false);
  const [allowSkipInDialog, setAllowSkipInDialog] = useState(false);
  const [dialogInitialPreference, setDialogInitialPreference] =
    useState<BoardDefaultsPreference | null>(null);
  const [savedPreference, setSavedPreference] =
    useState<BoardDefaultsPreference | null>(null);

  const handleSaveDefaults = useCallback(
    (preference: BoardDefaultsPreference) => {
      if (!userId) {
        return;
      }

      writeBoardDefaults(userId, {
        preference,
        prompted: true,
      });
      setSavedPreference(preference);
      setDefaultsDialogOpen(false);
      onSave?.(preference);
    },
    [onSave, userId]
  );

  const handleSkipDefaults = useCallback(() => {
    if (!userId) {
      return;
    }

    writeBoardDefaults(userId, {
      preference: null,
      prompted: true,
    });
    setSavedPreference(null);
    setDefaultsDialogOpen(false);
  }, [userId]);

  const handleDefaultsDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open && allowSkipInDialog) {
        handleSkipDefaults();
        return;
      }
      setDefaultsDialogOpen(open);
    },
    [allowSkipInDialog, handleSkipDefaults]
  );

  const promptDefaultsDialog = useCallback(
    (initialPreference: BoardDefaultsPreference | null, allowSkip: boolean) => {
      setDialogInitialPreference(initialPreference);
      setAllowSkipInDialog(allowSkip);
      setDefaultsDialogOpen(true);
    },
    []
  );

  const openDefaultsDialog = useCallback(
    (initialPreference: BoardDefaultsPreference | null) => {
      setDialogInitialPreference(initialPreference);
      setAllowSkipInDialog(false);
      setDefaultsDialogOpen(true);
    },
    []
  );

  return {
    defaultsDialogOpen,
    setDefaultsDialogOpen: handleDefaultsDialogOpenChange,
    allowSkipInDialog,
    dialogInitialPreference,
    savedPreference,
    setSavedPreference,
    handleSaveDefaults,
    handleSkipDefaults,
    promptDefaultsDialog,
    openDefaultsDialog,
  };
}
