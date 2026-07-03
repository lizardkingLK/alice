'use client';

import { FormEvent, useEffect, useState, type Dispatch } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { cn } from '@repo/ui/lib/utils';
import { createSprint, type Sprint } from '@/lib/api-client';
import { createClient } from '@/lib/supabase/client';
import type { Tables } from '@repo/types';
import { Loader2, X, CalendarPlus, CheckCircle, AlertCircle } from 'lucide-react';

type CreateSprintFormProps = {
  className?: string;
  onSprintCreated?: Dispatch<Sprint>;
  onClose?: () => void;
  onSuccess?: () => void;
};

export function CreateSprintForm({
  className,
  onSprintCreated,
  onClose,
  onSuccess,
}: Readonly<CreateSprintFormProps>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [projects, setProjects] = useState<Tables<'projects'>[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  useEffect(() => {
    const supabase = createClient();

    // Fetch active projects
    supabase
      .from('projects')
      .select('*')
      .eq('status', 'active')
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .then(
        ({ data }) => {
          if (data) {
            setProjects(data);
            if (data.length > 0 && data[0]) {
              setSelectedProjectId(data[0].id);
            }
          }
        },
        (error) => {
          console.error('Error fetching active projects:', error);
        }
      );
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const form = event.currentTarget;

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(form);
    const name = (formData.get('name') as string | null)?.trim() ?? '';
    const goal = (formData.get('goal') as string | null)?.trim() ?? '';
    const startDate =
      (formData.get('startDate') as string | null)?.trim() ?? '';
    const endDate = (formData.get('endDate') as string | null)?.trim() ?? '';

    if (!name || !startDate || !endDate) {
      setMessage('Name, start date, and end date are required.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    if (endDate < startDate) {
      setMessage('End date must be on or after the start date.');
      setIsError(true);
      setIsSubmitting(false);
      return;
    }

    try {
      if (!selectedProjectId) {
        setMessage('A project must be selected.');
        setIsError(true);
        setIsSubmitting(false);
        return;
      }

      const sprint = await createSprint({
        name,
        goal: goal || null,
        projectId: selectedProjectId,
        startDate,
        endDate,
      });

      setIsSuccess(true);
      onSprintCreated?.(sprint);
      setMessage(`Sprint "${sprint.name}" created.`);
      form.reset();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create sprint.';
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
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, onSuccess]);

  return (
    <Card className={cn("relative border border-gray-200 bg-white text-gray-900 shadow-xl transition-all duration-300 hover:shadow-2xl", className)}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="hover:bg-muted text-muted-foreground hover:text-foreground absolute top-4 right-4 cursor-pointer rounded-full p-1.5 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <CardHeader className="space-y-1.5 pb-4">
        <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <CalendarPlus className="text-primary h-5 w-5 animate-pulse" />
          Create Sprint
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Plan a new sprint with a name, goal, project and date range.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sprint-project">Project</Label>
            <select
              id="sprint-project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              required
              className="bg-background/80 border-input text-foreground focus:border-primary focus:ring-primary ring-offset-background flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} ({proj.key})
                </option>
              ))}
              {projects.length === 0 && (
                <option value="" disabled>
                  No active projects found.
                </option>
              )}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sprint-name">Sprint name</Label>
            <Input
              id="sprint-name"
              name="name"
              placeholder="Sprint 1"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sprint-goal">Goal</Label>
            <textarea
              id="sprint-goal"
              name="goal"
              rows={3}
              placeholder="What should this sprint achieve?"
              className={cn(
                'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 w-full min-w-0 resize-y rounded-lg border bg-transparent px-2.5 py-2 text-base transition-colors outline-none focus-visible:ring-3 md:text-sm'
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sprint-start-date">Start date</Label>
              <Input
                id="sprint-start-date"
                name="startDate"
                type="date"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sprint-end-date">End date</Label>
              <Input id="sprint-end-date" name="endDate" type="date" required />
            </div>
          </div>

          {message ? (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border p-3 text-sm',
                isError
                  ? 'text-destructive bg-destructive/10 border-destructive/20'
                  : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
              )}
            >
              {isError ? (
                <AlertCircle className="h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{message}</span>
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            {onClose && (
              <button
                type="button"
                disabled={isSubmitting || isSuccess}
                onClick={onClose}
                className="border-input bg-background hover:bg-accent text-foreground flex w-1/3 cursor-pointer items-center justify-center rounded-md border text-sm font-semibold shadow-sm transition-all duration-300"
              >
                Cancel
              </button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className={`${onClose ? 'w-2/3' : 'w-full'}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Sprint'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
