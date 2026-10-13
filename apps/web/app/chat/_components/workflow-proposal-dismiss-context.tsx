'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* eslint-disable no-unused-vars -- callback param names document the API */
type WorkflowProposalDismissContextValue = {
  /** Monotonic dismiss version per projectId. */
  readonly versions: Readonly<Record<string, number>>;
  readonly dismissProject: (projectId: string) => void;
};
/* eslint-enable no-unused-vars */

const WorkflowProposalDismissContext =
  createContext<WorkflowProposalDismissContextValue | null>(null);

export function WorkflowProposalDismissProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [versions, setVersions] = useState<Record<string, number>>({});

  const dismissProject = useCallback((projectId: string) => {
    setVersions((prev) => ({
      ...prev,
      [projectId]: (prev[projectId] ?? 0) + 1,
    }));
  }, []);

  const value = useMemo(
    () => ({ versions, dismissProject }),
    [versions, dismissProject]
  );

  return (
    <WorkflowProposalDismissContext.Provider value={value}>
      {children}
    </WorkflowProposalDismissContext.Provider>
  );
}

export function useWorkflowProposalDismiss(): WorkflowProposalDismissContextValue {
  const context = useContext(WorkflowProposalDismissContext);
  if (!context) {
    return {
      versions: {},
      dismissProject: () => undefined,
    };
  }
  return context;
}
