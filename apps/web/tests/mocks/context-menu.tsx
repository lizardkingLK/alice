import type { ReactNode } from 'react';

type ChildrenProps = {
  children?: ReactNode;
};

type ItemProps = ChildrenProps & {
  onClick?: () => void;
  onSelect?: () => void;
  disabled?: boolean;
  'data-testid'?: string;
  className?: string;
};

/**
 * Thin Radix context-menu stub for happy-dom — keeps items visible for tests.
 * Use via: vi.mock('@repo/ui/components/ui/context-menu', () => import('../mocks/context-menu'))
 */
export function ContextMenu({ children }: Readonly<ChildrenProps>) {
  return <div data-testid="context-menu">{children}</div>;
}

export function ContextMenuTrigger({
  children,
  asChild,
  ...props
}: Readonly<
  ChildrenProps & {
    asChild?: boolean;
    className?: string;
  }
>) {
  if (asChild) {
    return <>{children}</>;
  }
  return (
    <div data-testid="context-menu-trigger" {...props}>
      {children}
    </div>
  );
}

export function ContextMenuContent({
  children,
  ...props
}: Readonly<ChildrenProps & { className?: string; 'data-testid'?: string }>) {
  return (
    <div role="menu" data-testid="context-menu-content" {...props}>
      {children}
    </div>
  );
}

export function ContextMenuItem({
  children,
  onClick,
  onSelect,
  disabled,
  ...props
}: Readonly<ItemProps>) {
  const handleClick = () => {
    if (disabled) {
      return;
    }
    onClick?.();
    onSelect?.();
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export function ContextMenuLabel({ children }: Readonly<ChildrenProps>) {
  return <span>{children}</span>;
}

export function ContextMenuSeparator() {
  return <hr />;
}

export function ContextMenuShortcut({ children }: Readonly<ChildrenProps>) {
  return <span>{children}</span>;
}

export function ContextMenuGroup({ children }: Readonly<ChildrenProps>) {
  return <>{children}</>;
}

export function ContextMenuPortal({ children }: Readonly<ChildrenProps>) {
  return <>{children}</>;
}

export function ContextMenuSub({ children }: Readonly<ChildrenProps>) {
  return <>{children}</>;
}

export function ContextMenuSubTrigger({ children }: Readonly<ChildrenProps>) {
  return <div>{children}</div>;
}

export function ContextMenuSubContent({ children }: Readonly<ChildrenProps>) {
  return <div>{children}</div>;
}

export function ContextMenuCheckboxItem({ children }: Readonly<ChildrenProps>) {
  return <div>{children}</div>;
}

export function ContextMenuRadioItem({ children }: Readonly<ChildrenProps>) {
  return <div>{children}</div>;
}

export function ContextMenuRadioGroup({ children }: Readonly<ChildrenProps>) {
  return <>{children}</>;
}
