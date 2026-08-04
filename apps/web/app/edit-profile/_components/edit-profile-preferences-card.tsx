'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Label } from '@repo/ui/components/ui/label';
import { Switch } from '@repo/ui/components/ui/switch';
import {
  readWorkItemCreateFormMode,
  writeWorkItemCreateFormMode,
} from '@/app/work-items/_helpers/work-item-create-form-preference';

/**
 * Client-only preferences persisted in localStorage (this browser).
 */
export function EditProfilePreferencesCard() {
  const [modernCreate, setModernCreate] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModernCreate(readWorkItemCreateFormMode() === 'modern');
    setHydrated(true);
  }, []);

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>
          Stored in this browser only — they do not sync across devices.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-border divide-y">
        <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0 space-y-0.5">
            <Label
              htmlFor="pref-work-item-modern-create"
              className="text-sm font-medium"
            >
              Modern work item create
            </Label>
            <p className="text-muted-foreground text-xs">
              Use a Linear/Jira-style create dialog instead of the classic
              labeled form.
            </p>
          </div>
          <Switch
            id="pref-work-item-modern-create"
            checked={modernCreate}
            disabled={!hydrated}
            onCheckedChange={(checked) => {
              setModernCreate(checked);
              writeWorkItemCreateFormMode(checked ? 'modern' : 'classic');
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
