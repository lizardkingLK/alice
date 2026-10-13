'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import type {
  ChatWorkflowViewContext,
  WorkflowConfigEnvelope,
} from '@repo/types/api/v1';
import { useChatLauncherOptional } from '@/app/chat/_components/chat-launcher';

export type WorkflowAliceBridgeValue = {
  readonly projectId: string;
  readonly getViewContext: () => ChatWorkflowViewContext;
  readonly saveIfDirty: () => Promise<{
    readonly ok: boolean;
    readonly expectedUpdatedAt: string;
  }>;
  readonly applyEnvelope: (
    // eslint-disable-next-line no-unused-vars -- documents payload
    envelope: WorkflowConfigEnvelope,
    // eslint-disable-next-line no-unused-vars -- documents payload
    updatedAt: string
  ) => void;
};

/**
 * Register the workflow designer with the app-shell Alice dock so chat tools
 * receive live draft context and Apply can save/reload the canvas.
 */
export function useRegisterWorkflowAliceBridge(
  bridge: WorkflowAliceBridgeValue | null
): void {
  const launcher = useChatLauncherOptional();
  const setSurfaceBridge = launcher?.setSurfaceBridge;
  const setViewContext = launcher?.setViewContext;

  useEffect(() => {
    if (!setSurfaceBridge || !setViewContext) return;

    if (!bridge) {
      setSurfaceBridge(null);
      setViewContext(null);
      return;
    }

    setSurfaceBridge(bridge);
    setViewContext(bridge.getViewContext());

    return () => {
      setSurfaceBridge(null);
      setViewContext(null);
    };
  }, [bridge, setSurfaceBridge, setViewContext]);
}

/** Apply/Reject cards read the registered designer bridge from the launcher. */
export function useWorkflowAliceBridge(): WorkflowAliceBridgeValue | null {
  return useChatLauncherOptional()?.surfaceBridge ?? null;
}

type WorkflowAliceBridgeProviderProps = {
  readonly children: ReactNode;
  readonly projectId: string;
  readonly getViewContext: () => ChatWorkflowViewContext;
  readonly saveIfDirty: () => Promise<{
    readonly ok: boolean;
    readonly expectedUpdatedAt: string;
  }>;
  readonly applyEnvelope: (
    // eslint-disable-next-line no-unused-vars -- documents payload
    envelope: WorkflowConfigEnvelope,
    // eslint-disable-next-line no-unused-vars -- documents payload
    updatedAt: string
  ) => void;
};

/**
 * Test helper: registers a bridge for the duration of the subtree.
 * Production uses {@link useRegisterWorkflowAliceBridge} from the designer.
 */
export function WorkflowAliceBridgeProvider({
  children,
  projectId,
  getViewContext,
  saveIfDirty,
  applyEnvelope,
}: Readonly<WorkflowAliceBridgeProviderProps>) {
  const bridge = useMemo<WorkflowAliceBridgeValue>(
    () => ({
      projectId,
      getViewContext,
      saveIfDirty,
      applyEnvelope,
    }),
    [projectId, getViewContext, saveIfDirty, applyEnvelope]
  );

  useRegisterWorkflowAliceBridge(bridge);

  return children;
}
