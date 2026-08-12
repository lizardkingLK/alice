'use client';

import { FormEvent, useEffect, useState, type ChangeEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
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
import { FolderPlus, FolderEdit, Loader2, X } from '@repo/ui/lib/icons';
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
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function validateStep1(name: string, key: string, selectedOwnerId: string): string | null {
  if (!name.trim()) return 'Project Name is required.';
  if (!key.trim()) return 'Project Key is required.';
  if (!/^[A-Z0-9]+$/i.test(key)) return 'Project Key must contain only letters and numbers.';
  if (key.length < 2 || key.length > 10) return 'Project Key must be between 2 and 10 characters.';
  if (!selectedOwnerId) return 'Project Owner is required.';
  return null;
}

function validateStep2(importFromJira: boolean, jiraUrl: string, jiraProjectKey: string): string | null {
  if (importFromJira) {
    if (!jiraUrl.trim()) return 'Jira URL is required when Jira integration is enabled.';
    if (!jiraProjectKey.trim()) return 'Jira Project Key is required when Jira integration is enabled.';
  }
  return null;
}

function validateStep3(enableGithub: boolean, githubOwner: string, githubRepoName: string): string | null {
  if (enableGithub) {
    if (!githubOwner.trim()) return 'GitHub Owner / Organization is required when GitHub integration is enabled.';
    if (!githubRepoName.trim()) return 'GitHub Repository Name is required when GitHub integration is enabled.';
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
    importFromJira: boolean;
    jiraUrl: string;
    jiraProjectKey: string;
    enableGithub: boolean;
    githubOwner: string;
    githubRepoName: string;
  }
): string | null {
  if (currentStep === 1) {
    return validateStep1(fields.name, fields.key, fields.selectedOwnerId);
  }
  if (currentStep === 2) {
    return validateStep2(fields.importFromJira, fields.jiraUrl, fields.jiraProjectKey);
  }
  if (currentStep === 3) {
    return validateStep3(fields.enableGithub, fields.githubOwner, fields.githubRepoName);
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
  isEditMode,
  getTodayDateString,
}: Readonly<Step1Props>) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            Project Name
          </Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => setKeyString(e.target.value)}
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
          onChange={(e: ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
            min={isEditMode ? undefined : getTodayDateString()}
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
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEndDate(e.target.value)}
            className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}

/* eslint-disable no-unused-vars */
interface Step2Props {
  importFromJira: boolean;
  handleJiraCheckboxChange: (_checked: boolean) => void;
  jiraUrl: string;
  setJiraUrl: (_url: string) => void;
  jiraProjectKey: string;
  setJiraProjectKey: (_key: string) => void;
  handleTestConnection: () => Promise<void>;
  isTestingJira: boolean;
  jiraTestMessage: string | null;
  jiraTestError: boolean;
  previewIssues: Array<{ key: string; title: string; type: string }>;
}
/* eslint-enable no-unused-vars */

function Step2JiraIntegration({
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
}: Readonly<Step2Props>) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="flex items-center space-x-2 rounded-lg border border-border bg-muted/20 p-4">
        <Checkbox
          id="importFromJira"
          checked={importFromJira}
          onCheckedChange={(value) => handleJiraCheckboxChange(value === true)}
          className="cursor-pointer"
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="importFromJira"
            className="cursor-pointer text-sm font-semibold select-none"
          >
            Enable Jira Integration & Task Import
          </Label>
          <p className="text-muted-foreground text-xs">
            Automatically import active issues and configure tracking from Atlassian Jira.
          </p>
        </div>
      </div>

      {importFromJira && (
        <div className="border-border/60 bg-muted/30 flex flex-col justify-start space-y-4 rounded-lg border p-4">
          <div className="space-y-2">
            <Label htmlFor="jiraUrl" className="text-xs font-medium">
              Jira Cloud URL / Domain
            </Label>
            <Input
              id="jiraUrl"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              placeholder="e.g. company.atlassian.net"
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="jiraProjectKey" className="text-xs font-medium">
              Jira Project Key
            </Label>
            <Input
              id="jiraProjectKey"
              value={jiraProjectKey}
              onChange={(e) => setJiraProjectKey(e.target.value)}
              placeholder="e.g. PROJ"
              className="h-9 text-sm uppercase"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={isTestingJira}
              className="w-full self-start sm:w-auto"
            >
              {isTestingJira ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Testing Connection...
                </>
              ) : (
                'Test Connection & Preview'
              )}
            </Button>

            {jiraTestMessage && (
              <p
                className={`text-xs ${jiraTestError ? 'text-red-500' : 'text-green-600'} font-medium`}
              >
                {jiraTestMessage}
              </p>
            )}
          </div>

          {previewIssues.length > 0 && (
            <div className="mt-2 flex min-h-0 flex-1 flex-col space-y-1">
              <Label className="text-muted-foreground text-xs font-semibold">
                Tasks Preview (to be imported):
              </Label>
              <div className="border-border/40 bg-background/50 divide-border/20 max-h-48 flex-1 divide-y overflow-y-auto rounded border p-2 text-xs">
                {previewIssues.slice(0, 10).map((issue) => (
                  <div key={issue.key} className="flex justify-between gap-4 py-1.5">
                    <span className="text-muted-foreground shrink-0 font-mono">{issue.key}</span>
                    <span className="flex-1 truncate font-medium">{issue.title}</span>
                    <span className="text-muted-foreground bg-secondary/80 shrink-0 rounded px-1">
                      {issue.type}
                    </span>
                  </div>
                ))}
                {previewIssues.length > 10 && (
                  <div className="text-muted-foreground py-1 text-center">
                    ... and {previewIssues.length - 10} more tasks.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* eslint-disable no-unused-vars */
interface Step3Props {
  enableGithub: boolean;
  setEnableGithub: (_enable: boolean) => void;
  githubOwner: string;
  setGithubOwner: (_owner: string) => void;
  githubRepoName: string;
  setGithubRepoName: (_repoName: string) => void;
  githubToken: string;
  setGithubToken: (_token: string) => void;
}
/* eslint-enable no-unused-vars */

function Step3GitHubIntegration({
  enableGithub,
  setEnableGithub,
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
  githubToken,
  setGithubToken,
}: Readonly<Step3Props>) {
  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
      <div className="flex items-center space-x-2 rounded-lg border border-border bg-muted/20 p-4">
        <Checkbox
          id="enableGithub"
          checked={enableGithub}
          onCheckedChange={(value) => setEnableGithub(value === true)}
          className="cursor-pointer"
        />
        <div className="grid gap-1.5 leading-none">
          <Label
            htmlFor="enableGithub"
            className="cursor-pointer text-sm font-semibold select-none"
          >
            Enable GitHub Integration
          </Label>
          <p className="text-muted-foreground text-xs">
            Link pull requests, view commits, and track branches inside your tasks.
          </p>
        </div>
      </div>

      {enableGithub && (
        <div className="border-border/60 bg-muted/30 flex flex-col justify-start space-y-4 rounded-lg border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="githubOwner" className="text-xs font-semibold">
                GitHub Owner / Organization
              </Label>
              <Input
                id="githubOwner"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                placeholder="e.g. facebook"
                className="bg-background/50 h-9 text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="githubRepoName" className="text-xs font-semibold">
                GitHub Repository Name
              </Label>
              <Input
                id="githubRepoName"
                value={githubRepoName}
                onChange={(e) => setGithubRepoName(e.target.value)}
                placeholder="e.g. react"
                className="bg-background/50 h-9 text-sm"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="githubToken" className="text-xs font-semibold">
              Personal Access Token (optional)
            </Label>
            <Input
              id="githubToken"
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="e.g. ghp_xxxxxxxxxxxx"
              className="bg-background/50 h-9 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
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
        jira_url: importFromJira ? (jiraUrl.trim() || null) : null,
        jira_project_key: importFromJira ? (jiraProjectKey.toUpperCase().trim() || null) : null,
        github_repo: enableGithub ? (`${githubOwner.trim()}/${githubRepoName.trim()}`) : null,
        github_token: enableGithub ? (githubToken.trim() || null) : null,
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

  let submitButtonContent;
  if (isSubmitting) {
    submitButtonContent = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isEditMode ? 'Updating...' : 'Creating...'}
      </>
    );
  } else if (isEditMode) {
    submitButtonContent = 'Save Changes';
  } else {
    submitButtonContent = 'Create Project';
  }

  let backOrCancelButton = null;
  if (step > 1) {
    backOrCancelButton = (
      <Button
        key="back-btn"
        type="button"
        variant="outline"
        disabled={isSubmitting || isSuccess}
        onClick={() => setStep((s) => s - 1)}
        className="w-1/3"
      >
        Back
      </Button>
    );
  } else if (onClose) {
    backOrCancelButton = (
      <Button
        key="cancel-btn"
        type="button"
        variant="outline"
        disabled={isSubmitting || isSuccess}
        onClick={onClose}
        className="w-1/3"
      >
        Cancel
      </Button>
    );
  }

  return (
    <Card className="border-border bg-card text-card-foreground relative border shadow-2xl transition-all duration-300">
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-muted-foreground absolute top-4 right-4 h-8 w-8 cursor-pointer rounded-full transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      <CardHeader className="space-y-1.5 pb-4">
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

        {/* Stepper Header */}
        <div className="mt-4 flex items-center justify-between px-1">
          {[
            { number: 1, label: 'Basic Info' },
            { number: 2, label: 'Jira Integration' },
            { number: 3, label: 'GitHub Integration' },
          ].map((s, idx) => {
            const isActive = step === s.number;
            const isCompleted = step > s.number;
            let stepIconClass = 'bg-muted text-muted-foreground';
            if (isActive) {
              stepIconClass = 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-105';
            } else if (isCompleted) {
              stepIconClass = 'bg-emerald-500 text-white';
            }

            const stepTextClass = isActive
              ? 'text-foreground font-semibold'
              : 'text-muted-foreground';

            const lineClass = isCompleted ? 'bg-emerald-500' : 'bg-muted';

            return (
              <div key={s.number} className="flex flex-1 items-center last:flex-initial">
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
                      'text-[10px] font-medium tracking-tight whitespace-nowrap transition-colors duration-300 hidden sm:block',
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
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {step === 1 && (
            <Step1BasicDetails
              name={name}
              setName={setName}
              keyString={key}
              setKeyString={setKey}
              description={description}
              setDescription={setDescription}
              selectedOwnerId={selectedOwnerId}
              setSelectedOwnerId={setSelectedOwnerId}
              status={status}
              setStatus={setStatus}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              users={users}
              isEditMode={isEditMode}
              getTodayDateString={getTodayDateString}
            />
          )}

          {step === 2 && (
            <Step2JiraIntegration
              importFromJira={importFromJira}
              handleJiraCheckboxChange={handleJiraCheckboxChange}
              jiraUrl={jiraUrl}
              setJiraUrl={setJiraUrl}
              jiraProjectKey={jiraProjectKey}
              setJiraProjectKey={setJiraProjectKey}
              handleTestConnection={handleTestConnection}
              isTestingJira={isTestingJira}
              jiraTestMessage={jiraTestMessage}
              jiraTestError={jiraTestError}
              previewIssues={previewIssues}
            />
          )}

          {step === 3 && (
            <Step3GitHubIntegration
              enableGithub={enableGithub}
              setEnableGithub={setEnableGithub}
              githubOwner={githubOwner}
              setGithubOwner={setGithubOwner}
              githubRepoName={githubRepoName}
              setGithubRepoName={setGithubRepoName}
              githubToken={githubToken}
              setGithubToken={setGithubToken}
            />
          )}

          <FormAlertMessage message={message} isError={isError} />

          <div className="flex gap-3 pt-2">
            {backOrCancelButton}

            {step < 3 ? (
              <Button
                key="next-btn"
                type="button"
                disabled={isSubmitting || isSuccess}
                onClick={() => {
                  if (validateStep(step)) {
                    setStep((s) => s + 1);
                  }
                }}
                className={step > 1 || onClose ? 'w-2/3' : 'w-full'}
              >
                Next
              </Button>
            ) : (
              <Button
                key="submit-btn"
                type="submit"
                disabled={isSubmitting || isSuccess}
                className={step > 1 || onClose ? 'w-2/3' : 'w-full'}
              >
                {submitButtonContent}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
