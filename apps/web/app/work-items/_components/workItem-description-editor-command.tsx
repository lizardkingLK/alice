import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { memo, ReactNode } from 'react';

type EditorCommandProps = {
  isActive: boolean;
  readonly title: string;
  readonly onClick: () => void;
  readonly icon: ReactNode;
};

const EditorCommand = memo(function ({
  isActive,
  onClick,
  title,
  icon,
}: Readonly<EditorCommandProps>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={isActive ? 'secondary' : 'ghost'}
          className="h-8 w-8 shrink-0 cursor-pointer"
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        {title}
      </TooltipContent>
    </Tooltip>
  );
});

EditorCommand.displayName = 'EditorCommand';

export default EditorCommand;
