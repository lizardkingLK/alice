'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { Badge } from '@repo/ui/components/ui/badge';
import { Sparkles, Loader2 } from '@repo/ui/lib/icons';
import { generateFieldsSchemaWithAlice } from '@/app/chat/_services/chat.mutations.client';

/* eslint-disable no-unused-vars */
interface GenerateFieldsAliceDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly currentSchema?: unknown;
  readonly onGenerated: (schema: unknown) => void;
  readonly onError: (errorMessage: string) => void;
}
/* eslint-enable no-unused-vars */

const STARTER_PROMPTS = [
  'MoSCoW rating and acceptance criteria',
  'Security classification and compliance tier',
  'Customer impact score and release notes flag',
  'Defect severity, reproduction steps, and browser',
];

export function GenerateFieldsAliceDialog({
  open,
  onOpenChange,
  currentSchema,
  onGenerated,
  onError,
}: Readonly<GenerateFieldsAliceDialogProps>) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const response = await generateFieldsSchemaWithAlice(
        prompt.trim(),
        currentSchema
      );
      if (response && response.schema) {
        onGenerated(response.schema);
        onOpenChange(false);
        setPrompt('');
      } else {
        throw new Error('No schema returned by Alice Assistant.');
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to generate dynamic fields schema.';
      onError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary rounded-md p-1.5">
              <Sparkles className="size-4" />
            </div>
            <DialogTitle>Generate Fields with Alice</DialogTitle>
          </div>
          <DialogDescription>
            Describe your team&apos;s custom fields in natural language. Alice will
            generate a validated JSON Schema compliant with project standards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label
              htmlFor="alice-fields-prompt"
              className="text-foreground text-xs font-medium"
            >
              What custom fields does your project need?
            </label>
            <Textarea
              id="alice-fields-prompt"
              placeholder="e.g. I want every work item in this project to have a MoSCoW rating (Must, Should, Could, Won't), acceptance criteria text, and a release notes checkbox."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={isGenerating}
              className="resize-none font-sans text-sm"
            />
          </div>

          <div className="space-y-2">
            <span className="text-muted-foreground text-xs font-medium">
              Suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STARTER_PROMPTS.map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant="outline"
                  className="hover:bg-accent hover:text-accent-foreground cursor-pointer text-xs font-normal transition-colors"
                  onClick={() =>
                    setPrompt((prev) =>
                      prev ? `${prev}, and ${suggestion}` : suggestion
                    )
                  }
                >
                  + {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="gap-1.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Generating Schema...
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Schema
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
