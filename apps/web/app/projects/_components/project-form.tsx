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
      };

      let result;
      if (projectToEdit) {
        result = await updateProject(projectToEdit.id, projectData);
        setMessage(`Project "${result.name}" updated.`);
      } else {
        result = await createProject(projectData);
        setMessage(`Project "${result.name}" created.`);
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
