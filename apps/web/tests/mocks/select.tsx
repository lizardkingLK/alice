import type { ReactNode } from 'react';

type SelectProps = {
  readonly children: ReactNode;
  readonly value: string;
  // eslint-disable-next-line no-unused-vars
  readonly onValueChange: (val: string) => void;
  readonly disabled?: boolean;
};

type SelectTriggerProps = {
  readonly children: ReactNode;
  readonly id?: string;
  readonly className?: string;
};

type SelectItemProps = {
  readonly children: ReactNode;
  readonly value: string;
};

export function createSelectMock(testId = 'ui-select') {
  function Select({ children, value, onValueChange, disabled }: SelectProps) {
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

  function SelectTrigger({ children }: SelectTriggerProps) {
    return <>{children}</>;
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    return <>{placeholder}</>;
  }

  function SelectContent({ children }: { children: ReactNode }) {
    return <>{children}</>;
  }

  function SelectItem({ children, value }: SelectItemProps) {
    return <option value={value}>{children}</option>;
  }

  return {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
  };
}

export default createSelectMock();
