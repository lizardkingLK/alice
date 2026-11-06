'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatModelOption } from '@repo/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Loader2 } from '@repo/ui/lib/icons';
import { listChatModelsForChatClient } from '@/app/chat/_services/chat-models.reads.client';
import {
  chatModelDisplayLabel,
  chatProviderDisplayLabel,
} from '@/app/chat/_services/chat-models-api.shared';
import {
  getMemberChatModelPreference,
  putMemberChatModelPreference,
} from '@/app/chat/_services/member-chat-model-preference.client';
import { errorMessage } from '@/lib/errors/error-message';

const WORKSPACE_DEFAULT_VALUE = '__workspace_default__';

export function EditProfileChatModelPreferenceCard() {
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>(WORKSPACE_DEFAULT_VALUE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [orgModels, preference] = await Promise.all([
        listChatModelsForChatClient(),
        getMemberChatModelPreference(),
      ]);
      setModels(orgModels);
      const preferred = preference.default_integration_id;
      setSelectedId(
        preferred && orgModels.some((model) => model.id === preferred)
          ? preferred
          : WORKSPACE_DEFAULT_VALUE
      );
    } catch (error: unknown) {
      setModels([]);
      setSelectedId(WORKSPACE_DEFAULT_VALUE);
      setIsError(true);
      setFeedback(errorMessage(error, 'Failed to load chat model preference'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const nextId = selectedId === WORKSPACE_DEFAULT_VALUE ? null : selectedId;
      const saved = await putMemberChatModelPreference(nextId);
      setSelectedId(saved.default_integration_id ?? WORKSPACE_DEFAULT_VALUE);
      setIsError(false);
      setFeedback(
        saved.default_integration_id
          ? 'Personal Alice Chat default saved.'
          : 'Using the workspace default for Alice Chat.'
      );
    } catch (error: unknown) {
      setIsError(true);
      setFeedback(errorMessage(error, 'Failed to save chat model preference'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle>Alice Chat model</CardTitle>
        <CardDescription>
          Prefer an organization chat model when a conversation does not pick
          one explicitly. Project-bound pools still win when you chat in a
          project that has AI binds. Keys stay in Settings → Integrations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {feedback ? (
          <p
            className={
              isError
                ? 'text-destructive text-sm font-medium'
                : 'text-muted-foreground text-sm'
            }
          >
            {feedback}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="pref-chat-model">Preferred model</Label>
          {isLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading models...
            </div>
          ) : (
            <Select
              value={selectedId}
              onValueChange={setSelectedId}
              disabled={isSaving}
            >
              <SelectTrigger id="pref-chat-model" className="max-w-md">
                <SelectValue placeholder="Workspace default" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WORKSPACE_DEFAULT_VALUE}>
                  Workspace default
                </SelectItem>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {chatModelDisplayLabel(model)} ·{' '}
                    {chatProviderDisplayLabel(model.provider)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            disabled={isLoading || isSaving}
            onClick={() => void handleSave()}
          >
            {isSaving ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Saving
              </>
            ) : (
              'Save preference'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
