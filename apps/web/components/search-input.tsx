'use client';

import { useEffect, useRef, useState } from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@repo/ui/components/ui/input-group';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Search, X } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

const TOOLTIP_DELAY_MS = 400;

function shortcutLabel(): string {
  if (globalThis.window === undefined) {
    return 'Ctrl+K';
  }
  const platform = globalThis.navigator.platform ?? '';
  return /Mac|iPhone|iPad|iPod/i.test(platform) ? '⌘K' : 'Ctrl+K';
}

/* eslint-disable no-unused-vars */
interface SearchInputProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** Optional clear handler (defaults to emptying the value). */
  readonly onClear?: () => void;
  readonly placeholder?: string;
  readonly className?: string;
  /** Register Ctrl/⌘+K to focus this input. Default true. */
  readonly enableFocusShortcut?: boolean;
  /**
   * When false (default), the shortcut tooltip opens on hover only — not when
   * the field is focused (e.g. via Ctrl/⌘+K).
   */
  readonly openTooltipOnFocus?: boolean;
}
/* eslint-enable no-unused-vars */

/**
 * Search field with leading icon, optional clear addon ([Input Group](https://ui.shadcn.com/docs/components/base/input-group#button)),
 * and Ctrl/⌘+K focus (tooltip mentions the shortcut after a short delay).
 */
export function SearchInput({
  value,
  onValueChange,
  onClear,
  placeholder,
  className,
  enableFocusShortcut = true,
  openTooltipOnFocus = false,
}: Readonly<SearchInputProps>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pointerInsideRef = useRef(false);
  const [hotkey, setHotkey] = useState('Ctrl+K');
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const hasValue = value.trim().length > 0;
  const hoverOnlyTooltip = !openTooltipOnFocus;

  useEffect(() => {
    setHotkey(shortcutLabel());
  }, []);

  useEffect(() => {
    if (!enableFocusShortcut) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') {
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }
      event.preventDefault();
      const input = inputRef.current;
      if (!input) {
        return;
      }
      input.focus();
      input.select();
    };

    globalThis.window.addEventListener('keydown', onKeyDown);
    return () => globalThis.window.removeEventListener('keydown', onKeyDown);
  }, [enableFocusShortcut]);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onValueChange('');
    }
    inputRef.current?.focus();
  };

  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
      <Tooltip
        open={hoverOnlyTooltip ? tooltipOpen : undefined}
        onOpenChange={
          hoverOnlyTooltip
            ? (next) => {
                // Ignore focus-driven opens; only pointer hover may show the tip.
                if (next && !pointerInsideRef.current) {
                  return;
                }
                setTooltipOpen(next);
              }
            : undefined
        }
      >
        <TooltipTrigger
          asChild
          onPointerEnter={() => {
            if (!hoverOnlyTooltip) {
              return;
            }
            pointerInsideRef.current = true;
          }}
          onPointerLeave={() => {
            if (!hoverOnlyTooltip) {
              return;
            }
            pointerInsideRef.current = false;
            setTooltipOpen(false);
          }}
        >
          <InputGroup
            className={cn('h-9 max-w-md flex-1', className)}
            aria-label={`Search (${hotkey})`}
          >
            <InputGroupInput
              ref={inputRef}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
              placeholder={placeholder}
              aria-label="Search"
            />
            <InputGroupAddon align="inline-start">
              <Search className="size-4" />
            </InputGroupAddon>
            {hasValue ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label="Clear search"
                  onClick={handleClear}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Focus search{' '}
          <kbd
            data-slot="kbd"
            className="bg-background/20 text-background rounded-sm px-1.5 py-0.5 font-sans text-[10px] font-medium"
          >
            {hotkey}
          </kbd>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
