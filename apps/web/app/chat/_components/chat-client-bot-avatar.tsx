import { Sparkles } from '@repo/ui/lib/icons';

export default function ChatBotAvatar() {
  return (
    <div
      className="bg-primary/10 text-primary border-primary/20 flex size-8 shrink-0 items-center justify-center rounded-lg border"
      aria-hidden
    >
      <Sparkles className="size-4" />
    </div>
  );
}
