'use client';

import type { ReactNode } from 'react';
import { Label } from '@repo/ui/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/ui/radio-group';
import { cn } from '@repo/ui/lib/utils';

export const INTEGRATION_PROVIDER_NONE = 'none' as const;

export type IntegrationProviderRadioOption = {
  readonly value: string;
  readonly title: string;
  readonly description: string;
  readonly logo: ReactNode;
  readonly children?: ReactNode;
};

type IntegrationProviderRadioCardProps = {
  readonly id: string;
  readonly value: string;
  readonly title: string;
  readonly description: string;
  readonly logo?: ReactNode;
  readonly selected: boolean;
};

function IntegrationProviderRadioCard({
  id,
  value,
  title,
  description,
  logo,
  selected,
}: Readonly<IntegrationProviderRadioCardProps>) {
  return (
    <div
      className={cn(
        'border-border bg-muted/20 flex items-start gap-3 rounded-lg border p-4',
        selected && 'border-primary/40 bg-muted/40'
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5 cursor-pointer" />
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {logo ? (
          <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md border">
            {logo}
          </div>
        ) : null}
        <div className="grid min-w-0 gap-1 leading-none">
          <Label
            htmlFor={id}
            className="cursor-pointer text-sm font-semibold select-none"
          >
            {title}
          </Label>
          <p className="text-muted-foreground text-xs">{description}</p>
        </div>
      </div>
    </div>
  );
}

export type IntegrationProviderRadioGroupProps = {
  readonly idPrefix: string;
  readonly ariaLabel: string;
  readonly value: string;
  // eslint-disable-next-line no-unused-vars -- callback param documents next value
  readonly onValueChange: (next: string) => void;
  readonly noneDescription: string;
  readonly options: readonly IntegrationProviderRadioOption[];
};

/**
 * Single-select provider group (None + one live provider today) for SC / PM.
 */
export function IntegrationProviderRadioGroup({
  idPrefix,
  ariaLabel,
  value,
  onValueChange,
  noneDescription,
  options,
}: Readonly<IntegrationProviderRadioGroupProps>) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="space-y-3">
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        aria-label={ariaLabel}
        className="gap-3"
      >
        <IntegrationProviderRadioCard
          id={`${idPrefix}-none`}
          value={INTEGRATION_PROVIDER_NONE}
          title="None"
          description={noneDescription}
          selected={value === INTEGRATION_PROVIDER_NONE}
        />
        {options.map((option) => (
          <IntegrationProviderRadioCard
            key={option.value}
            id={`${idPrefix}-${option.value}`}
            value={option.value}
            title={option.title}
            description={option.description}
            logo={option.logo}
            selected={value === option.value}
          />
        ))}
      </RadioGroup>
      {selectedOption?.children ? (
        <div className="border-border/60 bg-muted/30 rounded-lg border p-4">
          {selectedOption.children}
        </div>
      ) : null}
    </div>
  );
}
