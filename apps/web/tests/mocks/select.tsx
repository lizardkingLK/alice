import type { ReactNode } from 'react';

type SelectProps = {
  readonly children: ReactNode;
  readonly value: string;
  // eslint-disable-next-line no-unused-vars
  readonly onValueChange: (val: string) => void;
  readonly disabled?: boolean;
  readonly 'data-testid'?: string;
};

type SelectTriggerProps = {
  readonly children: ReactNode;
  readonly id?: string;
  readonly className?: string;
};

type SelectValueProps = {
  readonly placeholder?: string;
};

type SelectContentProps = {
  readonly children: ReactNode;
};

type SelectItemProps = {
  readonly children: ReactNode;
  readonly value: string;
};

export function Select({
  children,
  value,
  onValueChange,
  disabled,
  'data-testid': testId = 'ui-select',
}: Readonly<SelectProps>) {
  return (
    <select
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      disabled={disabled}
      data-testid={testId}
    >
      {children}
    </select>
  );
}

export function SelectTrigger({
  children,
  id,
  className,
}: Readonly<SelectTriggerProps>) {
  return (
    <span id={id} className={className}>
      {children}
    </span>
  );
}

export function SelectValue({
  placeholder,
}: Readonly<SelectValueProps>) {
  return <>{placeholder}</>;
}

export function SelectContent({
  children,
}: Readonly<SelectContentProps>) {
  return <>{children}</>;
}

export function SelectItem({ children, value }: Readonly<SelectItemProps>) {
  return <option value={value}>{children}</option>;
}

/**
 * Factory kept for tests that need a custom data-testid on the root select.
 * Components live at module scope (Sonar S7721); only the testId is closed over.
 */
export function createSelectMock(testId = 'ui-select') {
  return {
    Select: (props: Readonly<Omit<SelectProps, 'data-testid'>>) => (
      <Select {...props} data-testid={testId} />
    ),
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
}

export default createSelectMock();
