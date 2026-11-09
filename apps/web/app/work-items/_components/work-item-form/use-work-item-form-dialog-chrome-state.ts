'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isWorkItemFormModalLayout,
  isWorkItemFormNonModalLayout,
  type WorkItemFormDialogLayout,
  type WorkItemFormModalLayout,
} from '@/app/work-items/_components/work-item-form/work-item-form-dialog-layout';

type UseWorkItemFormDialogChromeStateArgs = {
  readonly open: boolean;
  readonly allowFloatMinimize: boolean;
  readonly isModernCreate: boolean;
  readonly createIntentKey?: number;
};

/**
 * Layout + draft guards for modern create chrome (float / minimize / expand).
 * Extracted so {@link WorkItemFormDialog} stays under cognitive-complexity limits.
 */
export function useWorkItemFormDialogChromeState({
  open,
  allowFloatMinimize,
  isModernCreate,
  createIntentKey,
}: UseWorkItemFormDialogChromeStateArgs) {
  const [layout, setLayout] = useState<WorkItemFormDialogLayout>('center');
  const [modalLayout, setModalLayout] =
    useState<WorkItemFormModalLayout>('center');
  const [layoutBeforeMinimize, setLayoutBeforeMinimize] =
    useState<Exclude<WorkItemFormDialogLayout, 'minimized'>>('center');
  const [draftWarningOpen, setDraftWarningOpen] = useState(false);
  const [createEpoch, setCreateEpoch] = useState(0);
  const wasOpenRef = useRef(open);
  const createIntentKeyRef = useRef(createIntentKey);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setLayout('center');
      setModalLayout('center');
      setLayoutBeforeMinimize('center');
      setDraftWarningOpen(false);
    }
    wasOpenRef.current = open;
  }, [open]);

  const isNonModal = allowFloatMinimize && isWorkItemFormNonModalLayout(layout);
  const isMinimized = layout === 'minimized';
  const dialogModal = !allowFloatMinimize;

  const handleLayoutChange = useCallback(
    (next: WorkItemFormDialogLayout) => {
      if (!allowFloatMinimize && isWorkItemFormNonModalLayout(next)) {
        return;
      }
      setLayout((current) => {
        if (next === 'minimized' && current !== 'minimized') {
          setLayoutBeforeMinimize(current);
        }
        if (
          isWorkItemFormModalLayout(current) &&
          isWorkItemFormNonModalLayout(next)
        ) {
          setModalLayout(current);
        }
        return next;
      });
    },
    [allowFloatMinimize]
  );

  useEffect(() => {
    if (createIntentKey == null) {
      return;
    }
    if (createIntentKeyRef.current === undefined) {
      createIntentKeyRef.current = createIntentKey;
      return;
    }
    if (createIntentKey === createIntentKeyRef.current) {
      return;
    }
    createIntentKeyRef.current = createIntentKey;
    if (open && isModernCreate) {
      setDraftWarningOpen(true);
    }
  }, [createIntentKey, open, isModernCreate]);

  useEffect(() => {
    if (!open || !isModernCreate) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [open, isModernCreate]);

  const handleKeepEditing = useCallback(() => {
    setDraftWarningOpen(false);
    if (layout === 'minimized') {
      setLayout(layoutBeforeMinimize);
    }
  }, [layout, layoutBeforeMinimize]);

  const handleDiscardDraft = useCallback(() => {
    setDraftWarningOpen(false);
    setCreateEpoch((epoch) => epoch + 1);
    setLayout('center');
    setModalLayout('center');
    setLayoutBeforeMinimize('center');
  }, []);

  return {
    layout,
    modalLayout,
    layoutBeforeMinimize,
    draftWarningOpen,
    createEpoch,
    isNonModal,
    isMinimized,
    dialogModal,
    handleLayoutChange,
    handleKeepEditing,
    handleDiscardDraft,
  };
}
