'use client';

import * as React from 'react';
import { Info } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';

type InfoTooltipProps = {
  readonly children: React.ReactNode;
  readonly ariaLabel: string;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
  readonly size?: 'icon-xs' | 'icon-sm' | 'icon';
};

function InfoTooltip({
  children,
  ariaLabel,
  side = 'top',
  size = 'icon-xs',
}: InfoTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size={size}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={ariaLabel}
          >
            <Info />
          </Button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { InfoTooltip };
