'use client';

import {
  FormEvent,
  useEffect,
  useState,
  type ChangeEvent,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { SearchableSelect } from '@/components/searchable-select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  FolderPlus,
  FolderEdit,
  Loader2,
  X,
  Maximize2,
  Minimize2,
} from '@repo/ui/lib/icons';
import {
  buildDefaultProjectTypeDefs,
  findDuplicateWorkItemTypeName,
  initialSprintSchema,
  isProductUsableUser,
  normalizeProjectWorkItemTypeDefs,
  projectTypeKeys,
  type ProjectWorkItemTypeDef,
} from '@repo/types';
import { WorkItemTypeCatalogEditor } from '@/app/projects/_components/work-item-type-catalog-editor';
import type { ProjectWorkflowConfig } from '@repo/types/api/v1';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import type { User } from '@/app/users/_services/users.mutations.client';
import {
  createProject,
  updateProject,
  type Project,
  type CreateProjectInput,
} from '@/app/projects/_services/projects.mutations.client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import { cn } from '@repo/ui/lib/utils';
import { FormAlertMessage } from '@/components/form-alert-message';
import { toLocalYYYYMMDD } from '@/app/_shared/utility';
import {
  formatGithubRepoPath,
  parseGithubRepoPath,
} from '@/lib/projects/github-repo-path';
import {
  Step2Imports,
  Step3SourceControl,
  type Step2ImportsProps,
  type Step3SourceControlProps,
} from '@/app/projects/_components/project-form-integration-steps';
import {
  Step5Team,
  type Step5TeamProps,
} from '@/app/projects/_components/project-form-team-step';
import {
  clearProjectCreationDraft,
  PROJECT_CREATION_DRAFT_VERSION,
  readProjectCreationDraft,
  saveProjectCreationDraft,
  type ProjectCreationDraft,
} from '@/app/projects/_helpers/project-creation-draft-storage';
import { readProjectCreationDraftAuto } from '@/app/projects/_helpers/project-creation-draft-preference';

interface ProjectFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly projectToEdit?: Project | null;
  readonly users: User[];
  readonly currentUserId?: string | null;
  // eslint-disable-next-line no-unused-vars
  readonly onProjectUpdated?: (project: Project) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onJiraImportToggle?: (isWide: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onMaximizedChange?: (isMaximized: boolean) => void;
}

const DRAFT_STEP_LABELS = [
  'Details',
  'Types',
  'Imports',
  'Source',
  'Sprint',
  'Team',
] as const;

function formatDateForInput(dateString?: string | null) {
  if (!dateString) return '';
  return dateString.split('T')[0] ?? '';
}

function getTodayDateString() {
  return toLocalYYYYMMDD(new Date());
}

function validateProjectName(name: string): string | null {
  if (!name.trim()) return 'Project Name is required.';
  return null;
}

function validateProjectKey(key: string): string | null {
  if (!key.trim()) return 'Project Key is required.';
  if (!/^[A-Z0-9]+$/i.test(key))
    return 'Project Key must contain only letters and numbers.';
  if (key.length < 2 || key.length > 10)
    return 'Project Key must be between 2 and 10 characters.';
  return null;
}

function validateDateField(
  label: 'Start' | 'End',
  date: string,
  originalDate: string | undefined,
  isEditMode: boolean,
  todayStr: string,
  startDate?: string
): string | null {
  if (!date) return null;

  const isDateChanged = !isEditMode || date !== originalDate;

  if (isDateChanged && date < todayStr) {
    return `${label} Date cannot be a past date.`;
  }

  if (label === 'End' && startDate && date < startDate) {
    return 'End Date must be on or after the Start Date.';
  }

  return null;
}

function validateStep1({
  name,
  key,
  selectedOwnerId,
  startDate,
  endDate,
  isEditMode,
  todayStr,
  originalStartDate,
  originalEndDate,
}: {
  name: string;
  key: string;
  selectedOwnerId: string;
  startDate: string;
  endDate: string;
  isEditMode: boolean;
  todayStr: string;
  originalStartDate?: string;
  originalEndDate?: string;
}): string | null {
  const projectNameError = validateProjectName(name);
  if (projectNameError) return projectNameError;

  const projectKeyError = validateProjectKey(key);
  if (projectKeyError) return projectKeyError;

  if (!selectedOwnerId) return 'Project Owner is required.';

  const startDateError = validateDateField(
    'Start',
    startDate,
    originalStartDate,
    isEditMode,
    todayStr
  );
  if (startDateError) return startDateError;

  const endDateError = validateDateField(
    'End',
    endDate,
    originalEndDate,
    isEditMode,
    todayStr,
    startDate
  );
  if (endDateError) return endDateError;

  return null;
}

function validateTypesStep(
  workItemTypeDefs: ProjectWorkItemTypeDef[]
): string | null {
  if (!workItemTypeDefs || workItemTypeDefs.length === 0) {
    return 'At least one work-item type must be configured.';
  }
  if (findDuplicateWorkItemTypeName(workItemTypeDefs)) {
    return 'Type names must be unique. Change a duplicate name.';
  }
  return null;
}

function validateImportsStep(
  importFromJira: boolean,
  jiraConnectionId: string,
  jiraProjectKey: string
): string | null {
  if (importFromJira) {
    if (!jiraConnectionId.trim()) {
      return 'Select a Jira connection when Jira integration is enabled.';
    }
    if (!jiraProjectKey.trim()) {
      return 'Jira Project Key is required when Jira integration is enabled.';
    }
  }
  return null;
}

function validateSourceStep(
  enableGithub: boolean,
  githubOwner: string,
  githubRepoName: string
): string | null {
  if (enableGithub) {
    if (!githubOwner.trim())
      return 'GitHub Owner / Organization is required when GitHub integration is enabled.';
    if (!githubRepoName.trim())
      return 'GitHub Repository Name is required when GitHub integration is enabled.';
    if (githubOwner.includes('/') || githubRepoName.includes('/')) {
      return 'GitHub Owner and Repository Name must not contain slashes.';
    }
  }
  return null;
}

function validateSprintStep(
  createInitialSprint: boolean,
  name: string,
  goal: string,
  startDate: string,
  endDate: string
): string | null {
  if (!createInitialSprint) {
    return null;
  }

  const parsed = initialSprintSchema.safeParse({
    name,
    goal: goal || null,
    startDate,
    endDate,
  });

  return parsed.success
    ? null
    : (parsed.error.issues[0]?.message ?? 'Invalid sprint configuration.');
}

function validateTeamStep(
  createInitialTeam: boolean,
  teamName: string,
  teamManagerId: string
): string | null {
  // Team creation is optional.
  if (!createInitialTeam) {
    return null;
  }

  if (teamName.trim().length < 2) {
    return 'Team name must be at least 2 characters.';
  }

  if (!teamManagerId) {
    return 'Please select a team manager.';
  }

  return null;
}

function getStepError(
  currentStep: number,
  fields: {
    name: string;
    key: string;
    selectedOwnerId: string;
    startDate: string;
    endDate: string;
    isEditMode: boolean;
    todayStr: string;
    originalStartDate?: string;
    originalEndDate?: string;
    workItemTypeDefs: ProjectWorkItemTypeDef[];
    importFromJira: boolean;
    jiraConnectionId: string;
    jiraProjectKey: string;
    enableGithub: boolean;
    githubOwner: string;
    githubRepoName: string;
    createInitialSprint: boolean;
    sprintName: string;
    sprintGoal: string;
    sprintStartDate: string;
    sprintEndDate: string;
    createInitialTeam: boolean;
    teamName: string;
    teamManagerId: string;
  }
): string | null {
  if (currentStep === 1) {
    return validateStep1({
      name: fields.name,
      key: fields.key,
      selectedOwnerId: fields.selectedOwnerId,
      startDate: fields.startDate,
      endDate: fields.endDate,
      isEditMode: fields.isEditMode,
      todayStr: fields.todayStr,
      originalStartDate: fields.originalStartDate,
      originalEndDate: fields.originalEndDate,
    });
  }
  if (currentStep === 2) {
    return validateTypesStep(fields.workItemTypeDefs);
  }
  if (currentStep === 3) {
    return validateImportsStep(
      fields.importFromJira,
      fields.jiraConnectionId,
      fields.jiraProjectKey
    );
  }
  if (currentStep === 4) {
    return validateSourceStep(
      fields.enableGithub,
      fields.githubOwner,
      fields.githubRepoName
    );
  }
  if (currentStep === 5) {
    return validateSprintStep(
      fields.createInitialSprint,
      fields.sprintName,
      fields.sprintGoal,
      fields.sprintStartDate,
      fields.sprintEndDate
    );
  }
  if (currentStep === 6) {
    return validateTeamStep(
      fields.createInitialTeam,
      fields.teamName,
      fields.teamManagerId
    );
  }
  return null;
}

/* eslint-disable no-unused-vars */
interface Step1Props {
  name: string;
  setName: (_name: string) => void;
  keyString: string;
  setKeyString: (_key: string) => void;
  description: string;
  setDescription: (_description: string) => void;
  selectedOwnerId: string;
  setSelectedOwnerId: (_id: string) => void;
  status: 'active' | 'archived';
  setStatus: (_status: 'active' | 'archived') => void;
  startDate: string;
  setStartDate: (_date: string) => void;
  endDate: string;
  setEndDate: (_date: string) => void;
  users: User[];
  isEditMode: boolean;
  getTodayDateString: () => string;
}

type StepTypesProps = {
  workItemTypeDefs: ProjectWorkItemTypeDef[];
  setWorkItemTypeDefs: (_defs: ProjectWorkItemTypeDef[]) => void;
};
/* eslint-enable no-unused-vars */

function Step1BasicDetails({
  name,
  setName,
  keyString,
  setKeyString,
  description,
  setDescription,
  selectedOwnerId,
  setSelectedOwnerId,
  status,
  setStatus,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  users,
  getTodayDateString,
}: Readonly<Step1Props>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Project Name
          </Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
            placeholder="e.g. Alice Platform"
            required
            className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="key" className="text-sm font-medium">
            Project Key
          </Label>
          <Input
            id="key"
            name="key"
            value={keyString}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setKeyString(e.target.value)
            }
            placeholder="e.g. ALICE"
            required
            maxLength={10}
            className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 uppercase transition-colors"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          Description
        </Label>
        <Input
          id="description"
          name="description"
          value={description}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setDescription(e.target.value)
          }
          placeholder="e.g. Core platform squad for JIRA clone"
          className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="owner_id" className="text-sm font-medium">
            Project Owner
          </Label>
          <SearchableSelect
            id="owner_id"
            name="owner_id"
            value={selectedOwnerId}
            onValueChange={setSelectedOwnerId}
            placeholder="Search owners…"
            className="bg-background/80 h-10"
            options={users
              .filter((u) => u.role === 'manager')
              .map((u) => ({
                value: u.id,
                label: `${u.name} (${u.email})`,
              }))}
            emptyText="No matching managers."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status" className="text-sm font-medium">
            Status
          </Label>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as 'active' | 'archived')}
            name="status"
          >
            <SelectTrigger id="status" className="bg-background/80 h-10">
              <SelectValue placeholder="Select status..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start_date" className="text-sm font-medium">
            Start Date
          </Label>
          <Input
            id="start_date"
            name="start_date"
            type="date"
            value={startDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setStartDate(e.target.value)
            }
            min={getTodayDateString()}
            className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_date" className="text-sm font-medium">
            End Date
          </Label>
          <Input
            id="end_date"
            name="end_date"
            type="date"
            value={endDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEndDate(e.target.value)
            }
            min={
              startDate && startDate > getTodayDateString()
                ? startDate
                : getTodayDateString()
            }
            className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

function StepTypes({
  workItemTypeDefs,
  setWorkItemTypeDefs,
}: Readonly<StepTypesProps>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div>
        <Label className="text-sm font-medium">Work-Item Types</Label>
        <p className="text-muted-foreground text-xs">
          Drag to set hierarchy. Names, icons, and colors update the cards
          instantly.
        </p>
      </div>
      <WorkItemTypeCatalogEditor
        value={workItemTypeDefs}
        onChange={setWorkItemTypeDefs}
      />
    </div>
  );
}

/* eslint-disable no-unused-vars */
type Step4SprintProps = {
  createInitialSprint: boolean;
  setCreateInitialSprint: (_enabled: boolean) => void;
  sprintName: string;
  setSprintName: (_name: string) => void;
  sprintGoal: string;
  setSprintGoal: (_goal: string) => void;
  sprintStartDate: string;
  setSprintStartDate: (_date: string) => void;
  sprintEndDate: string;
  setSprintEndDate: (_date: string) => void;
};
/* eslint-enable no-unused-vars */

function Step4Sprint({
  createInitialSprint,
  setCreateInitialSprint,
  sprintName,
  setSprintName,
  sprintGoal,
  setSprintGoal,
  sprintStartDate,
  setSprintStartDate,
  sprintEndDate,
  setSprintEndDate,
}: Readonly<Step4SprintProps>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="create_initial_sprint"
            checked={createInitialSprint}
            onCheckedChange={(checked) =>
              setCreateInitialSprint(checked === true)
            }
          />
          <Label htmlFor="create_initial_sprint" className="font-medium">
            Create an initial sprint
          </Label>
        </div>
        <p className="text-muted-foreground text-xs">
          Optional. Skip this step to create the project without a sprint.
        </p>
      </div>

      {createInitialSprint ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sprint_name">Sprint Name</Label>
            <Input
              id="sprint_name"
              value={sprintName}
              onChange={(event) => setSprintName(event.target.value)}
              maxLength={200}
              placeholder="e.g. Sprint 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sprint_goal">Sprint Goal</Label>
            <Textarea
              id="sprint_goal"
              value={sprintGoal}
              onChange={(event) => setSprintGoal(event.target.value)}
              maxLength={2000}
              placeholder="What should this sprint achieve?"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sprint_start_date">Sprint Start Date</Label>
              <Input
                id="sprint_start_date"
                type="date"
                value={sprintStartDate}
                onChange={(event) => setSprintStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint_end_date">Sprint End Date</Label>
              <Input
                id="sprint_end_date"
                type="date"
                value={sprintEndDate}
                onChange={(event) => setSprintEndDate(event.target.value)}
                min={sprintStartDate || undefined}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProjectFormWindowActions({
  isMaximized,
  onToggleMaximize,
  onClose,
}: Readonly<{
  readonly isMaximized: boolean;
  readonly onToggleMaximize: () => void;
  readonly onClose?: () => void;
}>) {
  return (
    <div className="absolute top-4 right-4 flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggleMaximize}
        className="text-muted-foreground h-8 w-8 cursor-pointer rounded-full transition-colors"
        aria-label={isMaximized ? 'Minimize form' : 'Maximize form'}
        title={isMaximized ? 'Minimize form' : 'Maximize form'}
      >
        {isMaximized ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </Button>
      {onClose ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground h-8 w-8 cursor-pointer rounded-full transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }
    const originalStyle = globalThis.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [locked]);
}

function ProjectFormStepper({
  step,
  isEditMode,
}: Readonly<{ step: number; isEditMode: boolean }>) {
  const steps = [
    { number: 1, label: 'Details' },
    { number: 2, label: 'Types' },
    { number: 3, label: 'Imports' },
    { number: 4, label: 'Source' },
    ...(!isEditMode
      ? [
          { number: 5, label: 'Sprint' },
          { number: 6, label: 'Team' },
        ]
      : []),
  ];

  return (
    <div className="mt-4 flex items-center justify-between px-1">
      {steps.map((s, idx) => {
        const isActive = step === s.number;
        const isCompleted = step > s.number;
        let stepIconClass = 'bg-muted text-muted-foreground';
        if (isActive) {
          stepIconClass =
            'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105';
        } else if (isCompleted) {
          stepIconClass = 'bg-emerald-500 text-white';
        }

        const stepTextClass = isActive
          ? 'text-foreground font-semibold'
          : 'text-muted-foreground';

        const lineClass = isCompleted ? 'bg-emerald-500' : 'bg-muted';

        return (
          <div
            key={s.number}
            className="flex flex-1 items-center last:flex-initial"
          >
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                  stepIconClass
                )}
              >
                {isCompleted ? '✓' : s.number}
              </div>
              <span
                className={cn(
                  'hidden text-[10px] font-medium tracking-tight whitespace-nowrap transition-colors duration-300 sm:block',
                  stepTextClass
                )}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1 transition-colors duration-500',
                  lineClass
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function getSubmitButtonContent(
  isSubmitting: boolean,
  isEditMode: boolean
): ReactNode {
  if (isSubmitting) {
    return (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isEditMode ? 'Updating...' : 'Creating...'}
      </>
    );
  }
  return isEditMode ? 'Save Changes' : 'Create Project';
}

function ProjectDraftCloseDialog({
  open,
  error,
  onOpenChange,
  onSave,
  onDiscard,
}: Readonly<{
  open: boolean;
  error: string | null;
  // eslint-disable-next-line no-unused-vars
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
}>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} dismissOnOutsideClick={false}>
        <DialogHeader>
          <DialogTitle>Save project draft?</DialogTitle>
          <DialogDescription>
            Save your progress to continue later, or discard your changes.
          </DialogDescription>
        </DialogHeader>

        <FormAlertMessage message={error} isError />

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Keep Editing
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="destructive" onClick={onDiscard}>
              Discard Changes
            </Button>
            <Button type="button" onClick={onSave}>
              Save as Draft
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDraftResumePanel({
  draft,
  onResume,
  onStartFresh,
}: Readonly<{
  draft: ProjectCreationDraft;
  onResume: () => void;
  onStartFresh: () => void;
}>) {
  const savedStepLabel =
    DRAFT_STEP_LABELS[draft.currentStep - 1] ?? `Step ${draft.currentStep}`;
  const draftName = draft.basicInfo.name.trim() || 'Untitled project';
  const draftKey = draft.basicInfo.key.trim() || '—';

  return (
    <div className="animate-in fade-in mx-auto flex w-full max-w-lg flex-col gap-6 py-6 duration-300">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">
          Resume saved project draft?
        </h3>
        <p className="text-muted-foreground text-sm">
          Continue from your saved step, or start fresh. Starting fresh will
          permanently discard the saved draft.
        </p>
      </div>

      <div className="bg-muted/40 space-y-2 rounded-lg border p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Project</span>
          <span className="truncate font-medium">{draftName}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Key</span>
          <span className="font-mono text-xs font-medium uppercase">
            {draftKey}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Saved step</span>
          <span className="font-medium">{savedStepLabel}</span>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="destructive" onClick={onStartFresh}>
          Start Fresh
        </Button>
        <Button type="button" onClick={onResume}>
          Resume Draft
        </Button>
      </div>
    </div>
  );
}

function getRestoredPeople(
  draft: ProjectCreationDraft,
  users: User[]
): {
  selectedOwnerId: string;
  teamManagerId: string;
  teamMemberIds: string[];
  hasUnavailablePeople: boolean;
} {
  const ownerIsAvailable = users.some(
    (user) =>
      user.id === draft.basicInfo.selectedOwnerId && user.role === 'manager'
  );
  const usableUsers = users.filter(isProductUsableUser);
  const usableUserIds = new Set(usableUsers.map((user) => user.id));
  const managerIds = new Set(
    usableUsers
      .filter((user) => user.role === 'admin' || user.role === 'manager')
      .map((user) => user.id)
  );
  const selectedOwnerId = ownerIsAvailable
    ? draft.basicInfo.selectedOwnerId
    : '';
  const teamManagerId = managerIds.has(draft.team.teamManagerId)
    ? draft.team.teamManagerId
    : '';
  const teamMemberIds = [
    ...new Set(
      draft.team.teamMemberIds.filter((memberId) => usableUserIds.has(memberId))
    ),
  ];

  return {
    selectedOwnerId,
    teamManagerId,
    teamMemberIds,
    hasUnavailablePeople:
      selectedOwnerId !== draft.basicInfo.selectedOwnerId ||
      teamManagerId !== draft.team.teamManagerId ||
      teamMemberIds.length !== new Set(draft.team.teamMemberIds).size,
  };
}

function getSafeDraftStep(
  currentStep: ProjectCreationDraft['currentStep']
): ProjectCreationDraft['currentStep'] {
  return Math.min(
    6,
    Math.max(1, currentStep)
  ) as ProjectCreationDraft['currentStep'];
}

function getProjectFormCardClass(
  isMaximized: boolean,
  isCloseConfirmationOpen: boolean
) {
  return cn(
    'border-border bg-card text-card-foreground relative border shadow-2xl transition-all duration-200',
    isMaximized
      ? 'flex h-full min-h-0 w-full flex-col gap-0 overflow-hidden rounded-none'
      : 'overflow-visible',
    isMaximized && (isCloseConfirmationOpen ? 'z-40' : 'z-50')
  );
}

function ProjectFormNavButtons({
  step,
  finalStep,
  isBusy,
  isMaximized,
  onClose,
  onBack,
  submitLabel,
}: Readonly<{
  step: number;
  finalStep: number;
  isBusy: boolean;
  isMaximized: boolean;
  onClose?: () => void;
  onBack: () => void;
  submitLabel: ReactNode;
}>) {
  const showBack = step > 1;
  const showCancel = step <= 1 && Boolean(onClose);
  const secondaryClass = isMaximized ? 'min-w-28' : 'w-1/3';
  let primaryClass = 'w-full';
  if (isMaximized) {
    primaryClass = 'min-w-36';
  } else if (showBack || showCancel) {
    primaryClass = 'w-2/3';
  }

  return (
    <div
      className={cn(
        'flex gap-3 pt-2',
        isMaximized ? 'justify-end' : 'justify-stretch'
      )}
    >
      {showBack ? (
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={onBack}
          className={secondaryClass}
        >
          Back
        </Button>
      ) : null}
      {showCancel ? (
        <Button
          type="button"
          variant="outline"
          disabled={isBusy}
          onClick={onClose}
          className={secondaryClass}
        >
          Cancel
        </Button>
      ) : null}
      {/*
        Always type="submit" (label Next vs Create). Swapping a type="button"
        Next for a type="submit" final action under the same click can submit
        immediately and skip the newly rendered step.
      */}
      <Button type="submit" disabled={isBusy} className={primaryClass}>
        {step < finalStep ? 'Next' : submitLabel}
      </Button>
    </div>
  );
}

type ProjectFormStepBodyProps = {
  step: number;
  step1: ComponentProps<typeof Step1BasicDetails>;
  stepTypes: StepTypesProps;
  stepImports: Step2ImportsProps;
  stepSource: Step3SourceControlProps;
  stepSprint: Step4SprintProps;
  stepTeam: Step5TeamProps;
};

function ProjectFormStepBody({
  step,
  step1,
  stepTypes,
  stepImports,
  stepSource,
  stepSprint,
  stepTeam,
}: Readonly<ProjectFormStepBodyProps>) {
  if (step === 1) {
    return <Step1BasicDetails {...step1} />;
  }
  if (step === 2) {
    return <StepTypes {...stepTypes} />;
  }
  if (step === 3) {
    return <Step2Imports {...stepImports} />;
  }
  if (step === 4) {
    return <Step3SourceControl {...stepSource} />;
  }
  if (step === 5) {
    return <Step4Sprint {...stepSprint} />;
  }

  return <Step5Team {...stepTeam} />;
}

function resolveProjectFormHeaderDescription({
  awaitingDraftChoice,
  isEditMode,
}: Readonly<{
  awaitingDraftChoice: boolean;
  isEditMode: boolean;
}>): string {
  if (awaitingDraftChoice) {
    return 'A saved draft is available for this account.';
  }
  if (isEditMode) {
    return 'Modify details for the existing project.';
  }
  return 'Register a new project workspace to organize tasks and sprints.';
}

function ProjectFormScrollRegion({
  isMaximized,
  className,
  children,
}: Readonly<{
  isMaximized: boolean;
  className?: string;
  children: ReactNode;
}>) {
  return (
    <div
      className={cn(
        'p-0.5',
        isMaximized && 'no-scrollbar min-h-0 w-full flex-1 overflow-y-auto'
      )}
    >
      <div
        className={cn(
          isMaximized && 'mx-auto w-full max-w-4xl px-1 py-1.5',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

function ProjectFormContent({
  awaitingDraftChoice,
  availableDraft,
  isMaximized,
  onResumeDraft,
  onStartFresh,
  onSubmit,
  step,
  finalStep,
  isBusy,
  message,
  isError,
  onClose,
  onBack,
  submitLabel,
  stepBodyProps,
}: Readonly<{
  awaitingDraftChoice: boolean;
  availableDraft: ProjectCreationDraft | null;
  isMaximized: boolean;
  onResumeDraft: () => void;
  onStartFresh: () => void;
  // eslint-disable-next-line no-unused-vars
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  step: number;
  finalStep: number;
  isBusy: boolean;
  message: string | null;
  isError: boolean;
  onClose?: () => void;
  onBack: () => void;
  submitLabel: ReactNode;
  stepBodyProps: ProjectFormStepBodyProps;
}>) {
  if (awaitingDraftChoice && availableDraft) {
    return (
      <ProjectFormScrollRegion isMaximized={isMaximized}>
        <ProjectDraftResumePanel
          draft={availableDraft}
          onResume={onResumeDraft}
          onStartFresh={onStartFresh}
        />
      </ProjectFormScrollRegion>
    );
  }

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className={cn('space-y-4', isMaximized && 'flex min-h-0 flex-1 flex-col')}
    >
      <ProjectFormScrollRegion
        isMaximized={isMaximized}
        className={isMaximized ? 'space-y-4' : undefined}
      >
        <ProjectFormStepBody {...stepBodyProps} />
      </ProjectFormScrollRegion>

      <div
        className={cn(
          'space-y-3',
          isMaximized &&
            'mx-auto mt-auto w-full max-w-4xl shrink-0 border-t pt-3'
        )}
      >
        <FormAlertMessage message={message} isError={isError} />
        <ProjectFormNavButtons
          step={step}
          finalStep={finalStep}
          isBusy={isBusy}
          isMaximized={isMaximized}
          onClose={onClose}
          onBack={onBack}
          submitLabel={submitLabel}
        />
      </div>
    </form>
  );
}

export function ProjectForm({
  onClose,
  onSuccess,
  projectToEdit = null,
  users,
  currentUserId,
  onProjectUpdated,
  onJiraImportToggle,
  onMaximizedChange,
}: Readonly<ProjectFormProps>) {
  const isEditMode = !!projectToEdit;
  const { handleMutationError } = useOptimisticLock();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCloseConfirmationOpen, setIsCloseConfirmationOpen] = useState(false);
  const [draftSaveError, setDraftSaveError] = useState<string | null>(null);
  const [availableDraft, setAvailableDraft] =
    useState<ProjectCreationDraft | null>(null);
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(false);
  const [draftPrefsHydrated, setDraftPrefsHydrated] = useState(false);

  const [name, setName] = useState(projectToEdit?.name ?? '');
  const [key, setKey] = useState(projectToEdit?.key ?? '');
  const [description, setDescription] = useState(
    projectToEdit?.description ?? ''
  );
  const [selectedOwnerId, setSelectedOwnerId] = useState(
    projectToEdit?.owner_id ?? ''
  );
  const [status, setStatus] = useState<'active' | 'archived'>(
    projectToEdit?.status ?? 'active'
  );
  const [startDate, setStartDate] = useState(
    formatDateForInput(projectToEdit?.start_date)
  );
  const [endDate, setEndDate] = useState(
    formatDateForInput(projectToEdit?.end_date)
  );
  const initialWorkflowConfig = projectToEdit?.workflow_config as
    ProjectWorkflowConfig | null | undefined;
  const [workItemTypeDefs, setWorkItemTypeDefs] = useState<
    ProjectWorkItemTypeDef[]
  >(() =>
    normalizeProjectWorkItemTypeDefs(initialWorkflowConfig?.work_item_types)
  );

  // Stepper state
  const [step, setStep] = useState(1);
  // Create opens fullscreen; edit stays as a centered dialog by default.
  const [isMaximized, setIsMaximized] = useState(!projectToEdit);
  useBodyScrollLock(isMaximized);

  useEffect(() => {
    onMaximizedChange?.(isMaximized);
  }, [isMaximized, onMaximizedChange]);

  // Jira Integration States
  const [importFromJira, setImportFromJira] = useState(false);

  const handleJiraCheckboxChange = (checked: boolean) => {
    setImportFromJira(checked);
    onJiraImportToggle?.(checked);
  };
  const [jiraConnectionId, setJiraConnectionId] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');

  // GitHub Integration States
  const [enableGithub, setEnableGithub] = useState(false);
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubToken, setGithubToken] = useState('');

  // Initial Sprint States (create mode only)
  const [createInitialSprint, setCreateInitialSprint] = useState(false);
  const [sprintName, setSprintName] = useState('');
  const [sprintGoal, setSprintGoal] = useState('');
  const [sprintStartDate, setSprintStartDate] = useState('');
  const [sprintEndDate, setSprintEndDate] = useState('');
  // Initial Team States (create mode only)
  const [createInitialTeam, setCreateInitialTeam] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamManagerId, setTeamManagerId] = useState('');
  const [teamTechStack, setTeamTechStack] = useState('');
  const [teamMemberIds, setTeamMemberIds] = useState<string[]>([]);

  const finalStep = isEditMode ? 4 : 6;
  const defaultTypeDefs = buildDefaultProjectTypeDefs();
  const usesDefaultWorkItemTypes =
    workItemTypeDefs.length === defaultTypeDefs.length &&
    workItemTypeDefs.every(
      (def, index) =>
        def.key === defaultTypeDefs[index]?.key &&
        def.level === defaultTypeDefs[index]?.level
    );
  const hasCreateFormChanges =
    !isEditMode &&
    (step !== 1 ||
      name !== '' ||
      key !== '' ||
      description !== '' ||
      selectedOwnerId !== '' ||
      status !== 'active' ||
      (startDate !== '' && startDate !== getTodayDateString()) ||
      endDate !== '' ||
      !usesDefaultWorkItemTypes ||
      importFromJira ||
      jiraConnectionId !== '' ||
      jiraProjectKey !== '' ||
      enableGithub ||
      githubOwner !== '' ||
      githubRepoName !== '' ||
      githubToken !== '' ||
      createInitialSprint ||
      sprintName !== '' ||
      sprintGoal !== '' ||
      sprintStartDate !== '' ||
      sprintEndDate !== '' ||
      createInitialTeam ||
      teamName !== '' ||
      teamDescription !== '' ||
      teamManagerId !== '' ||
      teamTechStack !== '' ||
      teamMemberIds.length > 0);

  const buildProjectCreationDraft = (): ProjectCreationDraft => ({
    version: PROJECT_CREATION_DRAFT_VERSION,
    currentStep: step as ProjectCreationDraft['currentStep'],
    basicInfo: {
      name,
      key,
      description,
      selectedOwnerId,
      status,
      startDate,
      endDate,
      selectedWorkItemTypes: projectTypeKeys(workItemTypeDefs),
    },
    imports: {
      importFromJira,
      jiraConnectionId,
      jiraProjectKey,
    },
    sourceControl: {
      enableGithub,
      githubOwner,
      githubRepoName,
    },
    sprint: {
      createInitialSprint,
      sprintName,
      sprintGoal,
      sprintStartDate,
      sprintEndDate,
    },
    team: {
      createInitialTeam,
      teamName,
      teamDescription,
      teamManagerId,
      teamTechStack,
      teamMemberIds,
    },
  });

  const resetCreateForm = () => {
    setName('');
    setKey('');
    setDescription('');
    setSelectedOwnerId('');
    setStatus('active');
    setStartDate(getTodayDateString());
    setEndDate('');
    setWorkItemTypeDefs(buildDefaultProjectTypeDefs());
    setStep(1);
    setImportFromJira(false);
    setJiraConnectionId('');
    setJiraProjectKey('');
    setEnableGithub(false);
    setGithubOwner('');
    setGithubRepoName('');
    setGithubToken('');
    setCreateInitialSprint(false);
    setSprintName('');
    setSprintGoal('');
    setSprintStartDate('');
    setSprintEndDate('');
    setCreateInitialTeam(false);
    setTeamName('');
    setTeamDescription('');
    setTeamManagerId('');
    setTeamTechStack('');
    setTeamMemberIds([]);
    setMessage(null);
    setIsError(false);
    onJiraImportToggle?.(false);
  };

  const applyProjectCreationDraft = (draft: ProjectCreationDraft) => {
    const restoredPeople = getRestoredPeople(draft, users);
    setName(draft.basicInfo.name);
    setKey(draft.basicInfo.key);
    setDescription(draft.basicInfo.description);
    setSelectedOwnerId(restoredPeople.selectedOwnerId);
    setStatus(draft.basicInfo.status);
    setStartDate(draft.basicInfo.startDate);
    setEndDate(draft.basicInfo.endDate);
    setWorkItemTypeDefs(
      buildDefaultProjectTypeDefs(draft.basicInfo.selectedWorkItemTypes)
    );
    setImportFromJira(draft.imports.importFromJira);
    setJiraConnectionId(draft.imports.jiraConnectionId);
    setJiraProjectKey(draft.imports.jiraProjectKey);
    setEnableGithub(draft.sourceControl.enableGithub);
    setGithubOwner(draft.sourceControl.githubOwner);
    setGithubRepoName(draft.sourceControl.githubRepoName);
    setGithubToken('');
    setCreateInitialSprint(draft.sprint.createInitialSprint);
    setSprintName(draft.sprint.sprintName);
    setSprintGoal(draft.sprint.sprintGoal);
    setSprintStartDate(draft.sprint.sprintStartDate);
    setSprintEndDate(draft.sprint.sprintEndDate);
    setCreateInitialTeam(draft.team.createInitialTeam);
    setTeamName(draft.team.teamName);
    setTeamDescription(draft.team.teamDescription);
    setTeamManagerId(restoredPeople.teamManagerId);
    setTeamTechStack(draft.team.teamTechStack);
    setTeamMemberIds(restoredPeople.teamMemberIds);
    setStep(getSafeDraftStep(draft.currentStep));
    onJiraImportToggle?.(draft.imports.importFromJira);

    if (restoredPeople.hasUnavailablePeople) {
      setMessage(
        'Some saved users are no longer available. Please select replacements.'
      );
      setIsError(true);
    } else {
      setMessage(null);
      setIsError(false);
    }
  };

  const handleResumeDraft = () => {
    if (!availableDraft || isEditMode) return;
    applyProjectCreationDraft(availableDraft);
    setAvailableDraft(null);
  };

  const clearCurrentUserDraft = (): boolean => {
    try {
      return clearProjectCreationDraft(currentUserId);
    } catch {
      return false;
    }
  };

  const handleStartFresh = () => {
    clearCurrentUserDraft();
    resetCreateForm();
    setAvailableDraft(null);
  };

  const handleCloseRequest = () => {
    if (!onClose || isSubmitting) return;

    if (isEditMode || isSuccess || !hasCreateFormChanges) {
      onClose();
      return;
    }

    if (autoDraftEnabled) {
      if (currentUserId?.trim()) {
        saveProjectCreationDraft(currentUserId, buildProjectCreationDraft());
      }
      onClose();
      return;
    }

    setDraftSaveError(null);
    setIsCloseConfirmationOpen(true);
  };

  const handleCloseDialogOpenChange = (open: boolean) => {
    setIsCloseConfirmationOpen(open);
    if (!open) {
      setDraftSaveError(null);
    }
  };

  const handleSaveDraft = () => {
    if (!currentUserId?.trim()) {
      setDraftSaveError('Unable to save the draft because no user was found.');
      return;
    }

    const wasSaved = saveProjectCreationDraft(
      currentUserId,
      buildProjectCreationDraft()
    );
    if (!wasSaved) {
      setDraftSaveError(
        'Unable to save the draft. Please keep editing and try again.'
      );
      return;
    }

    setIsCloseConfirmationOpen(false);
    setDraftSaveError(null);
    onClose?.();
  };

  const handleDiscardChanges = () => {
    clearCurrentUserDraft();
    setIsCloseConfirmationOpen(false);
    setDraftSaveError(null);
    onClose?.();
  };
  const closeRequestHandler = onClose ? handleCloseRequest : undefined;

  const validateStep = (currentStep: number): boolean => {
    setMessage(null);
    setIsError(false);
    const errorMsg = getStepError(currentStep, {
      name,
      key,
      selectedOwnerId,
      startDate,
      endDate,
      isEditMode,
      todayStr: getTodayDateString(),
      originalStartDate: projectToEdit
        ? formatDateForInput(projectToEdit.start_date)
        : undefined,
      originalEndDate: projectToEdit
        ? formatDateForInput(projectToEdit.end_date)
        : undefined,
      workItemTypeDefs,
      importFromJira,
      jiraConnectionId,
      jiraProjectKey,
      enableGithub,
      githubOwner,
      githubRepoName,
      createInitialSprint,
      sprintName,
      sprintGoal,
      sprintStartDate,
      sprintEndDate,
      createInitialTeam,
      teamName,
      teamManagerId,
    });
    if (errorMsg) {
      setMessage(errorMsg);
      setIsError(true);
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!projectToEdit) {
      setStartDate(getTodayDateString());
      setWorkItemTypeDefs(buildDefaultProjectTypeDefs());
      return;
    }

    setName(projectToEdit.name);
    setKey(projectToEdit.key);
    setDescription(projectToEdit.description ?? '');
    setSelectedOwnerId(projectToEdit.owner_id);
    setStatus(projectToEdit.status);
    setStartDate(formatDateForInput(projectToEdit.start_date));
    setEndDate(formatDateForInput(projectToEdit.end_date));
    const editWorkflowConfig = projectToEdit.workflow_config as
      ProjectWorkflowConfig | null | undefined;
    setWorkItemTypeDefs(
      normalizeProjectWorkItemTypeDefs(editWorkflowConfig?.work_item_types)
    );

    const hasJira = Boolean(
      projectToEdit.jira_connection_id && projectToEdit.jira_project_key
    );
    setImportFromJira(hasJira);
    setJiraConnectionId(projectToEdit.jira_connection_id ?? '');
    setJiraProjectKey(projectToEdit.jira_project_key ?? '');

    const hasGithub = !!projectToEdit.github_repo;
    setEnableGithub(hasGithub);
    const { owner, repoName } = parseGithubRepoPath(projectToEdit.github_repo);
    setGithubOwner(owner);
    setGithubRepoName(repoName);
    setGithubToken('');
  }, [projectToEdit]);

  useEffect(() => {
    const enabled = readProjectCreationDraftAuto(currentUserId);
    setAutoDraftEnabled(enabled);
    setDraftPrefsHydrated(true);

    if (isEditMode) {
      setAvailableDraft(null);
      return;
    }

    const draft = readProjectCreationDraft(currentUserId);
    if (!draft) {
      setAvailableDraft(null);
      return;
    }

    if (enabled) {
      applyProjectCreationDraft(draft);
      setAvailableDraft(null);
      return;
    }

    setAvailableDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate draft once per user/mode
  }, [currentUserId, isEditMode]);

  useEffect(() => {
    if (
      !draftPrefsHydrated ||
      !autoDraftEnabled ||
      isEditMode ||
      isSuccess ||
      isSubmitting ||
      !currentUserId?.trim() ||
      !hasCreateFormChanges
    ) {
      return;
    }

    const timer = globalThis.setTimeout(() => {
      saveProjectCreationDraft(currentUserId, buildProjectCreationDraft());
    }, 400);

    return () => {
      globalThis.clearTimeout(timer);
    };
    // Persist whenever wizard fields that feed the draft change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field snapshot
  }, [
    draftPrefsHydrated,
    autoDraftEnabled,
    isEditMode,
    isSuccess,
    isSubmitting,
    currentUserId,
    hasCreateFormChanges,
    step,
    name,
    key,
    description,
    selectedOwnerId,
    status,
    startDate,
    endDate,
    workItemTypeDefs,
    importFromJira,
    jiraConnectionId,
    jiraProjectKey,
    enableGithub,
    githubOwner,
    githubRepoName,
    createInitialSprint,
    sprintName,
    sprintGoal,
    sprintStartDate,
    sprintEndDate,
    createInitialTeam,
    teamName,
    teamDescription,
    teamManagerId,
    teamTechStack,
    teamMemberIds,
  ]);

  const handleProjectUpdate = async (projectData: CreateProjectInput) => {
    if (!projectToEdit) return;
    const expectedUpdatedAt = projectToEdit.updated_at;
    const pendingFields = {
      name: projectData.name,
      key: projectData.key,
      description: projectData.description,
      owner_id: projectData.owner_id,
      start_date: projectData.start_date,
      end_date: projectData.end_date,
      status: projectData.status,
      attributes_config: projectData.attributes_config,
      workflow_config: projectData.workflow_config,
      jira_connection_id: projectData.jira_connection_id,
      jira_project_key: projectData.jira_project_key,
      github_repo: projectData.github_repo,
      github_token: projectData.github_token,
    };
    const result = await runLockedMutationOrThrow({
      mutate: () =>
        updateProject(projectToEdit.id, pendingFields, expectedUpdatedAt),
      handleMutationError,
      entityType: 'project',
      entityId: projectToEdit.id,
      expectedUpdatedAt,
      pendingFields,
    });
    if (result) {
      setMessage(`Project "${result.name}" updated.`);
      onProjectUpdated?.(result as Project);
    }
  };

  const handleProjectCreate = async (projectData: CreateProjectInput) => {
    const accepted = await createProject(projectData);
    clearCurrentUserDraft();
    const hasJiraConfig = Boolean(jiraConnectionId && jiraProjectKey);
    const jiraHint =
      importFromJira && hasJiraConfig
        ? ' After it appears in your inbox, open the project and import from the Integrations tab.'
        : '';
    setMessage(`${accepted.message}${jiraHint}`);
  };

  const resolveGithubToken = (): string | null | undefined => {
    if (!enableGithub) {
      return null;
    }
    if (githubToken.trim()) {
      return githubToken.trim();
    }
    // Edit: omit blank token so existing encrypted PAT is unchanged.
    if (projectToEdit) {
      return undefined;
    }
    return null;
  };

  const resolveSubmitError = (error: unknown, isEdit: boolean): string => {
    if (error instanceof Error) {
      return error.message;
    }
    return `Failed to ${isEdit ? 'update' : 'create'} project.`;
  };

  const resolveInitialSprintInput = (): Pick<CreateProjectInput, 'sprint'> => {
    if (projectToEdit || !createInitialSprint) {
      return {};
    }

    return {
      sprint: {
        name: sprintName.trim(),
        goal: sprintGoal.trim() || null,
        startDate: sprintStartDate,
        endDate: sprintEndDate,
      },
    };
  };

  const resolveInitialTeamInput = (): Pick<CreateProjectInput, 'team'> => {
    if (projectToEdit || !createInitialTeam) {
      return {};
    }

    return {
      team: {
        name: teamName.trim(),
        description: teamDescription.trim() || null,
        manager_id: teamManagerId,
        tech_stack: teamTechStack.trim() || null,
        status: 'active',
        member_ids: [...new Set(teamMemberIds)],
      },
    };
  };

  const validateFinalStep = (): boolean => {
    if (isEditMode) return true;

    for (let wizardStep = 1; wizardStep <= finalStep; wizardStep += 1) {
      if (!validateStep(wizardStep)) {
        setStep(wizardStep);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step < finalStep) {
      if (validateStep(step)) {
        setStep((s) => s + 1);
      }
      return;
    }

    if (!validateFinalStep()) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const hasRequiredFields = name.trim() && key.trim() && selectedOwnerId;
    if (!hasRequiredFields) {
      setMessage('Project Name, Key, and Owner are required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const linkedJira = Boolean(
        importFromJira && jiraConnectionId && jiraProjectKey
      );
      const existingConfig =
        typeof projectToEdit?.workflow_config === 'object' &&
        projectToEdit?.workflow_config !== null
          ? (projectToEdit.workflow_config as Record<string, unknown>)
          : {};

      const projectData: CreateProjectInput = {
        name: name.trim(),
        key: key.toUpperCase().trim(),
        description: description.trim() || null,
        owner_id: selectedOwnerId,
        start_date: startDate || null,
        end_date: endDate || null,
        status: status,
        attributes_config: null,
        workflow_config: {
          ...existingConfig,
          work_item_types: workItemTypeDefs,
        },
        jira_connection_id: linkedJira ? jiraConnectionId : null,
        jira_project_key: linkedJira
          ? jiraProjectKey.toUpperCase().trim()
          : null,
        github_repo: enableGithub
          ? formatGithubRepoPath(githubOwner, githubRepoName)
          : null,
        github_token: resolveGithubToken(),
        ...resolveInitialSprintInput(),
        ...resolveInitialTeamInput(),
      };

      if (projectToEdit) {
        await handleProjectUpdate(projectData);
      } else {
        await handleProjectCreate(projectData);
      }

      setIsSuccess(true);
    } catch (error) {
      setMessage(resolveSubmitError(error, Boolean(projectToEdit)));
      setIsError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onSuccess?.();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onSuccess]);

  const awaitingDraftChoice = !isEditMode && availableDraft !== null;
  const headerDescription = resolveProjectFormHeaderDescription({
    awaitingDraftChoice,
    isEditMode,
  });

  return (
    <Card
      className={getProjectFormCardClass(isMaximized, isCloseConfirmationOpen)}
    >
      <ProjectFormWindowActions
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((value) => !value)}
        onClose={closeRequestHandler}
      />

      <CardHeader
        className={cn(
          'shrink-0 space-y-1.5 pb-4',
          isMaximized && 'px-8 sm:px-12 md:px-16 lg:px-24'
        )}
      >
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          {isEditMode ? (
            <FolderEdit className="text-primary h-5 w-5" />
          ) : (
            <FolderPlus className="text-primary h-5 w-5 animate-pulse" />
          )}
          {isEditMode ? 'Edit Project' : 'Create New Project'}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          {headerDescription}
        </CardDescription>

        {!awaitingDraftChoice ? (
          <ProjectFormStepper step={step} isEditMode={isEditMode} />
        ) : null}
      </CardHeader>
      <CardContent
        className={cn(
          isMaximized &&
            'flex min-h-0 flex-1 flex-col overflow-hidden px-8 sm:px-12 md:px-16 lg:px-24'
        )}
      >
        <ProjectFormContent
          awaitingDraftChoice={awaitingDraftChoice}
          availableDraft={availableDraft}
          isMaximized={isMaximized}
          onResumeDraft={handleResumeDraft}
          onStartFresh={handleStartFresh}
          onSubmit={handleSubmit}
          step={step}
          finalStep={finalStep}
          isBusy={isSubmitting || isSuccess}
          message={message}
          isError={isError}
          onClose={closeRequestHandler}
          onBack={() => setStep((s) => s - 1)}
          submitLabel={getSubmitButtonContent(isSubmitting, isEditMode)}
          stepBodyProps={{
            step,
            step1: {
              name,
              setName,
              keyString: key,
              setKeyString: setKey,
              description,
              setDescription,
              selectedOwnerId,
              setSelectedOwnerId,
              status,
              setStatus,
              startDate,
              setStartDate,
              endDate,
              setEndDate,
              users,
              isEditMode,
              getTodayDateString,
            },
            stepTypes: {
              workItemTypeDefs,
              setWorkItemTypeDefs,
            },
            stepImports: {
              importFromJira,
              handleJiraCheckboxChange,
              jiraConnectionId,
              setJiraConnectionId,
              jiraProjectKey,
              setJiraProjectKey,
            },
            stepSource: {
              enableGithub,
              setEnableGithub,
              githubOwner,
              setGithubOwner,
              githubRepoName,
              setGithubRepoName,
              githubToken,
              setGithubToken,
            },
            stepSprint: {
              createInitialSprint,
              setCreateInitialSprint,
              sprintName,
              setSprintName,
              sprintGoal,
              setSprintGoal,
              sprintStartDate,
              setSprintStartDate,
              sprintEndDate,
              setSprintEndDate,
            },
            stepTeam: {
              createInitialTeam,
              setCreateInitialTeam,
              teamName,
              setTeamName,
              teamDescription,
              setTeamDescription,
              teamManagerId,
              setTeamManagerId,
              teamTechStack,
              setTeamTechStack,
              teamMemberIds,
              setTeamMemberIds,
              users,
            },
          }}
        />
      </CardContent>
      <ProjectDraftCloseDialog
        open={isCloseConfirmationOpen}
        error={draftSaveError}
        onOpenChange={handleCloseDialogOpenChange}
        onSave={handleSaveDraft}
        onDiscard={handleDiscardChanges}
      />
    </Card>
  );
}
