'use client';

import { useState } from 'react';
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL_VALUE,
  type ChatModelValue,
} from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { ExternalLink } from '@repo/ui/lib/icons';
import {
  integrationExternalHref,
  integrationStatusLabel,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';
import {
  IntegrationInitialsLink,
  IntegrationWebsiteLink,
} from '@/app/settings/_components/settings-integration-initials-link';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';

type IntegrationDetailDialogProps = {
  readonly integration: WorkspaceIntegration | null;
  readonly open: boolean;
  /* eslint-disable no-unused-vars -- callback param name documents the value */
  readonly onOpenChange: (open: boolean) => void;
  /* eslint-enable no-unused-vars */
};

export function IntegrationDetailDialog({
  integration,
  open,
  onOpenChange,
}: Readonly<IntegrationDetailDialogProps>) {
  const [model, setModel] = useState<ChatModelValue>(DEFAULT_CHAT_MODEL_VALUE);
  const [feedback, setFeedback] = useState<{
    success: string | null;
    error: string | null;
  }>({ success: null, error: null });

  if (!integration) {
    return null;
  }

  const externalHref = integrationExternalHref(integration.websiteUrl);
  const isGemini = integration.id === 'alice-gemini';

  const handleSaveDefault = () => {
    setFeedback({
      success: 'Default model saved for your workspace.',
      error: null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-4 pr-8">
          <div className="flex items-start gap-4">
            <IntegrationInitialsLink
              name={integration.name}
              href={externalHref}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-left">
                  {integration.name}
                </DialogTitle>
                <Badge variant="secondary" className="shrink-0">
                  {integrationStatusLabel(integration.status)}
                </Badge>
              </div>
              <IntegrationWebsiteLink
                href={externalHref}
                label={integration.websiteUrl}
              />
            </div>
          </div>
          <DialogDescription className="text-left text-sm leading-relaxed">
            {integration.description}
          </DialogDescription>
        </DialogHeader>

        {integration.highlights?.length ? (
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            {integration.highlights.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {isGemini ? (
          <div className="space-y-4">
            <FormStatusAlerts
              error={feedback.error}
              success={feedback.success}
            />
            <div className="space-y-2">
              <Label htmlFor="workspace-chat-model">Default model</Label>
              <Select
                value={model}
                onValueChange={(value) => setModel(value as ChatModelValue)}
              >
                <SelectTrigger id="workspace-chat-model" className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CHAT_MODELS).map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Choose which Gemini model Alice uses by default in chat for
                everyone in your workspace.
              </p>
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" asChild>
            <a href={externalHref} target="_blank" rel="noopener noreferrer">
              Visit website
              <ExternalLink className="size-4" data-icon="inline-end" />
            </a>
          </Button>
          <div className="flex flex-wrap gap-2">
            {isGemini ? (
              <Button type="button" onClick={handleSaveDefault}>
                Save default
              </Button>
            ) : (
              <>
                <Button type="button" disabled>
                  Connect
                </Button>
                <Button type="button" variant="outline" disabled>
                  Configure
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
