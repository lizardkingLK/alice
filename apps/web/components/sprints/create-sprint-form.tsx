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

type CreateSprintFormProps = {
  className?: string;
  onSprintCreated?: Dispatch<Sprint>;
};

export function CreateSprintForm({
  className,
  onSprintCreated,
}: Readonly<CreateSprintFormProps>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

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

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create Sprint</CardTitle>
        <CardDescription>
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
            <output
              className={cn(
                'block text-sm',
                isError ? 'text-destructive' : 'text-muted-foreground'
              )}
            >
              {message}
            </output>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating…' : 'Create Sprint'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
