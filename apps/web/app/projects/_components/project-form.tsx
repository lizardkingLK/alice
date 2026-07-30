'use client';

import { FormCancelSubmitActions } from '@/components/form-cancel-submit-actions';
import { FormEvent, useEffect, useState, type ChangeEvent } from 'react';
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
} from '../_services/projects.service';
import { apiFetch } from '@/lib/api/api-client';

interface ProjectFormProps {
  readonly onClose?: () => void;
  readonly onSuccess?: () => void;
  readonly projectToEdit?: Project | null;
  readonly users: User[];
  // eslint-disable-next-line no-unused-vars
  readonly onProjectUpdated?: (project: Project) => void;
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

export function ProjectForm({
  onClose,
  onSuccess,
  projectToEdit = null,
  users,
  onProjectUpdated,
}: Readonly<ProjectFormProps>) {
  const isEditMode = !!projectToEdit;
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

  // Jira Integration States
  const [importFromJira, setImportFromJira] = useState(false);
  const [jiraUrl, setJiraUrl] = useState('');
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [isTestingJira, setIsTestingJira] = useState(false);
  const [jiraTestMessage, setJiraTestMessage] = useState<string | null>(null);
  const [jiraTestError, setJiraTestError] = useState(false);
  const [previewIssues, setPreviewIssues] = useState<Array<{ key: string; title: string; type: string }>>([]);

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
      const response = await apiFetch<{ issues: Array<{ key: string; title: string; type: string }> }>(
        '/api/projects/jira/preview',
        {
          method: 'POST',
          body: JSON.stringify({
            jiraUrl: jiraUrl.trim(),
            jiraProjectKey: jiraProjectKey.toUpperCase().trim(),
          }),
        }
      );
      setPreviewIssues(response.issues);
      setJiraTestMessage(`Successfully connected! Found ${response.issues.length} tasks ready to import.`);
      setJiraTestError(false);
    } catch (err) {
      console.error('Jira preview error:', err);
      setJiraTestMessage(err instanceof Error ? err.message : 'Jira connection test failed.');
      setJiraTestError(true);
    } finally {
      setIsTestingJira(false);
    }
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
  }, [projectToEdit]);

  // Default start date to today in create mode
  useEffect(() => {
    if (!isEditMode) {
      setStartDate(getTodayDateString());
    }
  }, [isEditMode]);

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

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
        jira_url: jiraUrl.trim() || null,
        jira_project_key: jiraProjectKey.toUpperCase().trim() || null,
      };

      let result;
      if (projectToEdit) {
        result = await updateProject(projectToEdit.id, projectData);
        setMessage(`Project "${result.name}" updated.`);
      } else {
        result = await createProject(projectData);
        setMessage(`Project "${result.name}" created.`);

        const hasJiraConfig = jiraUrl && jiraProjectKey;
        if (importFromJira && hasJiraConfig) {
          setMessage(`Project created. Importing tasks from Jira...`);
          await handleJiraImport(result.id, result.name);
        }
      }

      setIsSuccess(true);
      onProjectUpdated?.(result as Project);
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

  let submitButtonText;
  if (isSubmitting) {
    submitButtonText = (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {isEditMode ? 'Updating...' : 'Creating...'}
      </>
    );
  } else if (isEditMode) {
    submitButtonText = 'Save Changes';
  } else {
    submitButtonText = 'Create Project';
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
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                value={key}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setKey(e.target.value)
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
              <Select
                value={selectedOwnerId}
                onValueChange={setSelectedOwnerId}
                name="owner_id"
              >
                <SelectTrigger id="owner_id" className="bg-background/80 h-10">
                  <SelectValue placeholder="Select Owner..." />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.role === 'manager')
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
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
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEndDate(e.target.value)
                }
                className="bg-background/80 focus-visible:ring-primary border-input focus:border-primary h-10 transition-colors"
              />
            </div>
          </div>

          {!isEditMode && (
            <div className="border-border/60 bg-muted/30 rounded-lg border p-4 space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  id="importFromJira"
                  type="checkbox"
                  checked={importFromJira}
                  onChange={(e) => setImportFromJira(e.target.checked)}
                  className="accent-primary h-4 w-4 rounded border-gray-300 focus:ring-primary"
                />
                <Label htmlFor="importFromJira" className="text-sm font-semibold cursor-pointer">
                  Import tasks from Jira Cloud
                </Label>
              </div>

              {importFromJira && (
                <div className="space-y-4 pt-2 border-t border-border/40 animate-fade-in">
                  <div className="space-y-2">
                    <Label htmlFor="jiraUrl" className="text-xs font-medium">Jira Cloud URL / Domain</Label>
                    <Input
                      id="jiraUrl"
                      value={jiraUrl}
                      onChange={(e) => setJiraUrl(e.target.value)}
                      placeholder="e.g. company.atlassian.net"
                      className="h-9 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="jiraProjectKey" className="text-xs font-medium">Jira Project Key</Label>
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
                      className="w-full sm:w-auto self-start"
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
                      <p className={`text-xs ${jiraTestError ? 'text-red-500' : 'text-green-600'} font-medium`}>
                        {jiraTestMessage}
                      </p>
                    )}
                  </div>

                  {previewIssues.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <Label className="text-xs font-semibold text-muted-foreground">Tasks Preview (to be imported):</Label>
                      <div className="max-h-32 overflow-y-auto border border-border/40 rounded bg-background/50 p-2 text-xs divide-y divide-border/20">
                        {previewIssues.slice(0, 10).map((issue) => (
                          <div key={issue.key} className="py-1.5 flex justify-between gap-4">
                            <span className="font-mono text-muted-foreground shrink-0">{issue.key}</span>
                            <span className="font-medium truncate flex-1">{issue.title}</span>
                            <span className="text-muted-foreground shrink-0 bg-secondary/80 px-1 rounded">{issue.type}</span>
                          </div>
                        ))}
                        {previewIssues.length > 10 && (
                          <div className="py-1 text-center text-muted-foreground">
                            ... and {previewIssues.length - 10} more tasks.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <FormCancelSubmitActions
            message={message}
            isError={isError}
            isBusy={isSubmitting || isSuccess}
            onCancel={onClose}
            submitLabel={submitButtonText}
          />
        </form>
      </CardContent>
    </Card>
  );
}
