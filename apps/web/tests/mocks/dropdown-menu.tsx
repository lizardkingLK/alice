import { createContext, useContext, type ReactNode } from 'react';

type ChildrenProps = {
  children?: ReactNode;
};

type ItemProps = ChildrenProps & {
  onClick?: () => void;
};

type RadioGroupProps = ChildrenProps & {
  value?: string;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onValueChange?: (value: string) => void;
};

type RadioItemProps = ChildrenProps & {
  value: string;
};

/**
 * Thin Radix dropdown stub for happy-dom — avoids portal/pointer internals.
 * Use via: vi.mock('@repo/ui/components/ui/dropdown-menu', () => import('../mocks/dropdown-menu'))
 */
export function DropdownMenu({ children }: Readonly<ChildrenProps>) {
  return <div data-testid="dropdown-menu">{children}</div>;
}

export function DropdownMenuTrigger({ children }: Readonly<ChildrenProps>) {
  return <div data-testid="dropdown-menu-trigger">{children}</div>;
}

export function DropdownMenuContent({ children }: Readonly<ChildrenProps>) {
  return <div data-testid="dropdown-menu-content">{children}</div>;
}

export function DropdownMenuItem({ children, onClick }: ItemProps) {
  return (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export function DropdownMenuPortal({ children }: Readonly<ChildrenProps>) {
  return <>{children}</>;
}

export function DropdownMenuGroup({ children }: Readonly<ChildrenProps>) {
  return <>{children}</>;
}

export function DropdownMenuLabel({ children }: Readonly<ChildrenProps>) {
  return <span>{children}</span>;
}

export function DropdownMenuSeparator() {
  return <hr />;
}

export function DropdownMenuShortcut({ children }: Readonly<ChildrenProps>) {
  return <span>{children}</span>;
}

// eslint-disable-next-line no-unused-vars
const RadioGroupContext = createContext<((value: string) => void) | null>(null);

export function DropdownMenuRadioGroup({
  children,
  onValueChange,
}: Readonly<RadioGroupProps>) {
  return (
    <div data-testid="dropdown-menu-radio-group">
      <RadioGroupContext.Provider value={onValueChange ?? null}>
        {children}
      </RadioGroupContext.Provider>
    </div>
  );
}

export function DropdownMenuRadioItem({
  children,
  value,
}: Readonly<RadioItemProps>) {
  const onValueChange = useContext(RadioGroupContext);
  return (
    <button type="button" onClick={() => onValueChange?.(value)}>
      {children}
    </button>
  );
}
