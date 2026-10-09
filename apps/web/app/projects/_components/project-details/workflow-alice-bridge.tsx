'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  ChatWorkflowViewContext,
  WorkflowConfigEnvelope,
} from '@repo/types/api/v1';

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

const WorkflowAliceBridgeContext =
  createContext<WorkflowAliceBridgeValue | null>(null);

export function useWorkflowAliceBridge(): WorkflowAliceBridgeValue | null {
  return useContext(WorkflowAliceBridgeContext);
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

export function WorkflowAliceBridgeProvider({
  children,
  projectId,
  getViewContext,
  saveIfDirty,
  applyEnvelope,
}: Readonly<WorkflowAliceBridgeProviderProps>) {
  const value = useMemo<WorkflowAliceBridgeValue>(
    () => ({
      projectId,
      getViewContext,
      saveIfDirty,
      applyEnvelope,
    }),
    [projectId, getViewContext, saveIfDirty, applyEnvelope]
  );

  return (
    <WorkflowAliceBridgeContext.Provider value={value}>
      {children}
    </WorkflowAliceBridgeContext.Provider>
  );
}
