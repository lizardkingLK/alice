import { Spinner } from '@repo/ui/components/ui/spinner';

/** Centered loading row for org chat-model lists (create wizard + project settings). */
export function ProjectAiModelsLoading() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
      <Spinner className="size-4" />
      Loading chat models...
    </div>
  );
}
