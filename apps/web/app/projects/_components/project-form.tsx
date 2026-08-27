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
  FolderPlus,
  FolderEdit,
  Loader2,
  X,
  Maximize2,
  Minimize2,
} from '@repo/ui/lib/icons';
import type { User } from '@/app/users/_services/users.service';
import {
  createProject,
  updateProject,
  type Project,
  type CreateProjectInput,
} from '../_services/projects.service';
import { apiFetch } from '@/lib/api/api-client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import { cn } from '@repo/ui/lib/utils';
import { FormAlertMessage } from '@/components/form-alert-message';
import { toLocalYYYYMMDD } from '@/app/_shared/utility';
import {
  Step2Imports,
  Step3SourceControl,
  type Step2ImportsProps,
  type Step3SourceControlProps,
} from './project-form-integration-steps';

interface ProjectFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly projectToEdit?: Project | null;
  readonly users: User[];
  // eslint-disable-next-line no-unused-vars
  readonly onProjectUpdated?: (project: Project) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onJiraImportToggle?: (isWide: boolean) => void;
}

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

function validateStep2(
  importFromJira: boolean,
  jiraUrl: string,
  jiraProjectKey: string
): string | null {
  if (importFromJira) {
    if (!jiraUrl.trim())
      return 'Jira URL is required when Jira integration is enabled.';
    if (!jiraProjectKey.trim())
      return 'Jira Project Key is required when Jira integration is enabled.';
  }
  return null;
}

function validateStep3(
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
    importFromJira: boolean;
    jiraUrl: string;
    jiraProjectKey: string;
    enableGithub: boolean;
    githubOwner: string;
    githubRepoName: string;
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
    return validateStep2(
      fields.importFromJira,
      fields.jiraUrl,
      fields.jiraProjectKey
    );
  }
  if (currentStep === 3) {
    return validateStep3(
      fields.enableGithub,
      fields.githubOwner,
      fields.githubRepoName
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

function ProjectFormStepper({ step }: Readonly<{ step: number }>) {
  return (
    <div className="mt-4 flex items-center justify-between px-1">
      {[
        { number: 1, label: 'Basic Info' },
        { number: 2, label: 'Imports' },
        { number: 3, label: 'Source Control' },
      ].map((s, idx) => {
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
            {idx < 2 && (
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

function ProjectFormNavButtons({
  step,
  isBusy,
  isMaximized,
  onClose,
  onBack,
  onNext,
  submitLabel,
}: Readonly<{
  step: number;
  isBusy: boolean;
  isMaximized: boolean;
  onClose?: () => void;
  onBack: () => void;
  onNext: () => void;
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
      {step < 3 ? (
        <Button
          type="button"
          disabled={isBusy}
          onClick={onNext}
          className={primaryClass}
        >
          Next
        </Button>
      ) : (
        <Button type="submit" disabled={isBusy} className={primaryClass}>
          {submitLabel}
        </Button>
      )}
    </div>
  );
}

function ProjectFormStepBody({
  step,
  step1,
  step2,
  step3,
}: Readonly<{
  step: number;
  step1: ComponentProps<typeof Step1BasicDetails>;
  step2: Step2ImportsProps;
  step3: Step3SourceControlProps;
}>) {
  if (step === 1) {
    return <Step1BasicDetails {...step1} />;
  }
  if (step === 2) {
    return <Step2Imports {...step2} />;
  }
  return <Step3SourceControl {...step3} />;
}

export function ProjectForm({
  onClose,
  onSuccess,
  projectToEdit = null,
  users,
  onProjectUpdated,
  onJiraImportToggle,
}: Readonly<ProjectFormProps>) {
  const isEditMode = !!projectToEdit;
  const { handleMutationError } = useOptimisticLock();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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

  // Stepper state
  const [step, setStep] = useState(1);
  const [isMaximized, setIsMaximized] = useState(false);
  useBodyScrollLock(isMaximized);

  // Jira Integration States
  const [importFromJira, setImportFromJira] = useState(false);

  const handleJiraCheckboxChange = (checked: boolean) => {
    setImportFromJira(checked);
    onJiraImportToggle?.(checked);
  };
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [isTestingJira, setIsTestingJira] = useState(false);
  const [jiraTestMessage, setJiraTestMessage] = useState<string | null>(null);
  const [jiraTestError, setJiraTestError] = useState(false);
  const [previewIssues, setPreviewIssues] = useState<
    Array<{ key: string; title: string; type: string }>
  >([]);

  // GitHub Integration States
  const [enableGithub, setEnableGithub] = useState(false);
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubToken, setGithubToken] = useState('');

  const handleTestConnection = async () => {
    if (!jiraUrl.trim() || !jiraProjectKey.trim()) {
      setJiraTestMessage('Please enter both Jira Domain and Project Key.');
      setJiraTestError(true);
      return;
    }

    setIsTestingJira(true);
    setJiraTestMessage(null);
    setJiraTestError(false);
    setPreviewIssues([]);

    try {
      const response = await apiFetch<{
        issues: Array<{ key: string; title: string; type: string }>;
      }>('/api/projects/jira/preview', {
        method: 'POST',
        body: JSON.stringify({
          jiraUrl: jiraUrl.trim(),
          jiraProjectKey: jiraProjectKey.toUpperCase().trim(),
        }),
      });
      setPreviewIssues(response.issues);
      setJiraTestMessage(
        `Successfully connected! Found ${response.issues.length} tasks ready to import.`
      );
      setJiraTestError(false);
    } catch (err) {
      console.error('Jira preview error:', err);
      setJiraTestMessage(
        err instanceof Error ? err.message : 'Jira connection test failed.'
      );
      setJiraTestError(true);
    } finally {
      setIsTestingJira(false);
    }
  };

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
      importFromJira,
      jiraUrl,
      jiraProjectKey,
      enableGithub,
      githubOwner,
      githubRepoName,
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
      return;
    }

    setName(projectToEdit.name);
    setKey(projectToEdit.key);
    setDescription(projectToEdit.description ?? '');
    setSelectedOwnerId(projectToEdit.owner_id);
    setStatus(projectToEdit.status);
    setStartDate(formatDateForInput(projectToEdit.start_date));
    setEndDate(formatDateForInput(projectToEdit.end_date));

    // Initialize Jira Settings
    const hasJira = !!projectToEdit.jira_url;
    setImportFromJira(hasJira);
    setJiraUrl(projectToEdit.jira_url ?? '');
    setJiraProjectKey(projectToEdit.jira_project_key ?? '');

    // Initialize GitHub Settings
    const hasGithub = !!projectToEdit.github_repo;
    setEnableGithub(hasGithub);
    if (projectToEdit.github_repo) {
      const parts = projectToEdit.github_repo.split('/');
      setGithubOwner(parts[0] ?? '');
      setGithubRepoName(parts[1] ?? '');
    } else {
      setGithubOwner('');
      setGithubRepoName('');
    }
    setGithubToken(projectToEdit.github_token ?? '');
  }, [projectToEdit]);

  const handleJiraImport = async (projectId: string, projectName: string) => {
    try {
      const importRes = await apiFetch<{ importedCount: number }>(
        '/api/projects/jira/import',
        {
          method: 'POST',
          body: JSON.stringify({
            projectId,
            jiraUrl: jiraUrl.trim(),
            jiraProjectKey: jiraProjectKey.toUpperCase().trim(),
          }),
        }
      );
      setMessage(
        `Project "${projectName}" created and ${importRes.importedCount} tasks successfully imported from Jira!`
      );
    } catch (err) {
      console.error('Jira import failed:', err);
      setMessage(
        `Project created, but task import failed: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`
      );
      setIsError(true);
    }
  };

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
      jira_url: projectData.jira_url,
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
    const result = await createProject(projectData);
    setMessage(`Project "${result.name}" created.`);

    const hasJiraConfig = jiraUrl && jiraProjectKey;
    if (importFromJira && hasJiraConfig) {
      setMessage(`Project created. Importing tasks from Jira...`);
      await handleJiraImport(result.id, result.name);
    }
    onProjectUpdated?.(result as Project);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step < 3) {
      if (validateStep(step)) {
        setStep((s) => s + 1);
      }
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    if (!name.trim() || !key.trim() || !selectedOwnerId) {
      setMessage('Project Name, Key, and Owner are required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const projectData = {
        name: name.trim(),
        key: key.toUpperCase().trim(),
        description: description.trim() || null,
        owner_id: selectedOwnerId,
        start_date: startDate || null,
        end_date: endDate || null,
        status: status,
        attributes_config: null,
        workflow_config: null,
        jira_url: importFromJira ? jiraUrl.trim() || null : null,
        jira_project_key: importFromJira
          ? jiraProjectKey.toUpperCase().trim() || null
          : null,
        github_repo: enableGithub
          ? `${githubOwner.trim()}/${githubRepoName.trim()}`
          : null,
        github_token: enableGithub ? githubToken.trim() || null : null,
      };

      if (projectToEdit) {
        await handleProjectUpdate(projectData);
      } else {
        await handleProjectCreate(projectData);
      }

      setIsSuccess(true);
    } catch (error) {
      const modeText = projectToEdit ? 'update' : 'create';
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to ${modeText} project.`;
      setMessage(errorMessage);
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

  return (
    <Card
      className={cn(
        'border-border bg-card text-card-foreground relative border shadow-2xl transition-all duration-200',
        isMaximized
          ? 'fixed inset-0 z-60 flex h-screen w-screen flex-col gap-0 overflow-hidden rounded-none'
          : 'overflow-visible'
      )}
    >
      <ProjectFormWindowActions
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((value) => !value)}
        onClose={onClose}
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
          {isEditMode
            ? 'Modify details for the existing project.'
            : 'Register a new project workspace to organize tasks and sprints.'}
        </CardDescription>

        <ProjectFormStepper step={step} />
      </CardHeader>
      <CardContent
        className={cn(
          isMaximized &&
            'flex min-h-0 flex-1 flex-col overflow-hidden px-8 sm:px-12 md:px-16 lg:px-24'
        )}
      >
        <form
          onSubmit={handleSubmit}
          className={cn(
            'space-y-4',
            isMaximized && 'flex min-h-0 flex-1 flex-col'
          )}
        >
          <div
            className={cn(
              'p-0.5',
              isMaximized &&
                'no-scrollbar mx-auto min-h-0 w-full max-w-4xl flex-1 space-y-4 overflow-y-auto px-1 py-1.5'
            )}
          >
            <ProjectFormStepBody
              step={step}
              step1={{
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
              }}
              step2={{
                importFromJira,
                handleJiraCheckboxChange,
                jiraUrl,
                setJiraUrl,
                jiraProjectKey,
                setJiraProjectKey,
                handleTestConnection,
                isTestingJira,
                jiraTestMessage,
                jiraTestError,
                previewIssues,
              }}
              step3={{
                enableGithub,
                setEnableGithub,
                githubOwner,
                setGithubOwner,
                githubRepoName,
                setGithubRepoName,
                githubToken,
                setGithubToken,
              }}
            />
          </div>

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
              isBusy={isSubmitting || isSuccess}
              isMaximized={isMaximized}
              onClose={onClose}
              onBack={() => setStep((s) => s - 1)}
              onNext={() => {
                if (validateStep(step)) {
                  setStep((s) => s + 1);
                }
              }}
              submitLabel={getSubmitButtonContent(isSubmitting, isEditMode)}
            />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
