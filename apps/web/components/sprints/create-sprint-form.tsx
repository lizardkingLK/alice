'use client';

import { FormEvent, useState } from 'react';
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

type CreateSprintFormProps = {
  className?: string;
};

export function CreateSprintForm({
  className,
}: Readonly<CreateSprintFormProps>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const goal = String(formData.get('goal') ?? '').trim();
    const startDate = String(formData.get('startDate') ?? '');
    const endDate = String(formData.get('endDate') ?? '');

    if (!name || !startDate || !endDate) {
      setMessage('Name, start date, and end date are required.');
      setIsSubmitting(false);
      return;
    }

    if (endDate < startDate) {
      setMessage('End date must be on or after the start date.');
      setIsSubmitting(false);
      return;
    }

    // UI-only for now — backend wiring comes next.
    console.info('info. sprint create payload:', {
      name,
      goal: goal || null,
      startDate,
      endDate,
    });

    setMessage(
      'Sprint form is ready. Saving will be enabled once the API is connected.'
    );
    event.currentTarget.reset();
    setIsSubmitting(false);
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Create Sprint</CardTitle>
        <CardDescription>
          Plan a new sprint with a name, goal, and date range.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <p className="text-muted-foreground text-sm" role="status">
              {message}
            </p>
          ) : null}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating…' : 'Create Sprint'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
