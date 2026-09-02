import { SUGGESTIONS } from '@/app/chat/_components/chat-client.data';
import { Button } from '@repo/ui/components/ui/button';
import { Sparkles } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type ChatHeroSectionProps = {
  isPage: boolean;
  // eslint-disable-next-line no-unused-vars
  handleSendMessage: (textToSend: string) => void;
};

export default function ChatHeroSection({
  isPage,
  handleSendMessage,
}: Readonly<ChatHeroSectionProps>) {
  return (
    <div
      className={cn(
        'no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto',
        isPage ? 'px-4 py-6 sm:px-6' : 'p-4'
      )}
    >
      <div
        className={cn(
          'mx-auto my-auto flex w-full flex-col items-center space-y-6 text-center',
          isPage ? 'max-w-md' : 'max-w-xs'
        )}
      >
        <div className="bg-primary/5 text-primary flex size-16 items-center justify-center rounded-full">
          <Sparkles className="size-8 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold tracking-tight">
            How can I help you today?
          </h3>
          <p className="text-muted-foreground text-sm">
            Ask me to create a project, manage sprints, assign tasks to team
            members, or handle complete workflow creation conversations.
          </p>
        </div>

        <div className="mt-4 grid w-full grid-cols-1 gap-3">
          {SUGGESTIONS.map((suggestion) => (
            <Button
              type="button"
              key={suggestion.title}
              variant="outline"
              onClick={() => handleSendMessage(suggestion.prompt)}
              className="group border-border hover:border-primary/45 h-auto items-start gap-3 px-4 py-4 text-left whitespace-normal"
            >
              <div className="bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary flex size-8 shrink-0 items-center justify-center rounded-md transition-colors">
                <suggestion.icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h4 className="group-hover:text-primary text-sm font-medium transition-colors">
                  {suggestion.title}
                </h4>
                <p
                  className="text-muted-foreground line-clamp-2 text-xs font-normal"
                  title={suggestion.prompt}
                >
                  {suggestion.prompt}
                </p>
              </div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
