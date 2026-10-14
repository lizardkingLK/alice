'use client';

import { useEffect, useState } from 'react';
import { WorkItemDetailsConfigureForm } from '@/app/work-items/_components/work-item-details/work-item-details-configure-form';
import {
  DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
  normalizeWorkItemDetailsPreferences,
  readWorkItemDetailsPreferences,
  writeWorkItemDetailsPreferences,
  type WorkItemDetailsPreferences,
} from '@/app/work-items/_helpers/work-item-details-preferences';
import {
  readWorkItemCreateFormMode,
  writeWorkItemCreateFormMode,
} from '@/app/work-items/_helpers/work-item-create-form-preference';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Label } from '@repo/ui/components/ui/label';
import { Switch } from '@repo/ui/components/ui/switch';

type EditProfilePreferencesCardProps = {
  readonly userId?: string | null;
};

/**
 * Client-only preferences persisted in localStorage (this browser).
 */
export function EditProfilePreferencesCard({
  userId = null,
}: Readonly<EditProfilePreferencesCardProps>) {
  const [modernCreate, setModernCreate] = useState(false);
  const [detailsPrefs, setDetailsPrefs] = useState<WorkItemDetailsPreferences>(
    () =>
      normalizeWorkItemDetailsPreferences(DEFAULT_WORK_ITEM_DETAILS_PREFERENCES)
  );
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModernCreate(readWorkItemCreateFormMode() === 'modern');
    setDetailsPrefs(readWorkItemDetailsPreferences(userId));
    setHydrated(true);
  }, [userId]);

  return (
    <div className="space-y-6">
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
                Use a compact create dialog with quick fields instead of the
                full form layout.
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

      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Work item details</CardTitle>
          <CardDescription>
            Banner, title icon, and which sections or fields you see — same
            choices as Configure on a work item.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkItemDetailsConfigureForm
            value={detailsPrefs}
            disabled={!hydrated}
            onChange={(next) => {
              const normalized = normalizeWorkItemDetailsPreferences(next);
              setDetailsPrefs(normalized);
              writeWorkItemDetailsPreferences(userId, normalized);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
