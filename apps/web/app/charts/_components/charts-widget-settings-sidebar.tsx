'use client';

import { useState, type ComponentType, type ReactNode } from 'react';
import { BOARD_WORK_ITEM_STATUSES } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  Calendar,
  ChartArea,
  ChartBar,
  ChartColumn,
  ChartLine,
  ChartPie,
  ChartScatter,
  Check,
  ChevronDown,
  Donut,
  Info,
  LayoutGrid,
  List,
  Paintbrush,
  PieChart,
  Settings,
  TextCursorInput,
  User,
  Rows3,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type {
  ChartPieVariant,
  ChartsLabelFieldId,
} from '@/app/charts/_components/charts.types';
import { DEFAULT_CHARTS_LABEL_FIELD } from '@/app/charts/_components/charts-sample.data';
import { CHARTS_LIVE_LABEL_COLUMNS } from '@/app/charts/_helpers/charts-analytics.ui';
import { STATUS_META } from '@/app/work-items/_helpers/work-item-status';

type ChartsWidgetSettingsSidebarProps = {
  readonly pieVariant: ChartPieVariant;
  // eslint-disable-next-line no-unused-vars -- pie subtype change
  readonly onPieVariantChange: (variant: ChartPieVariant) => void;
  readonly labelField?: ChartsLabelFieldId;
  // eslint-disable-next-line no-unused-vars -- labels column change
  readonly onLabelFieldChange?: (field: ChartsLabelFieldId) => void;
  readonly className?: string;
};

type ChartTypeOption = {
  readonly id: string;
  readonly label: string;
  readonly Icon: ComponentType<{ className?: string }>;
  readonly enabled?: boolean;
  readonly variant?: ChartPieVariant;
};

const MOST_POPULAR_OPTIONS: readonly ChartTypeOption[] = [
  {
    id: 'popular-pie',
    label: 'Pie',
    Icon: PieChart,
    enabled: true,
    variant: 'donut',
  },
  { id: 'popular-bar', label: 'Bar', Icon: ChartBar },
  { id: 'popular-line', label: 'Line', Icon: ChartLine },
  { id: 'popular-column', label: 'Column', Icon: ChartColumn },
  { id: 'popular-bubble', label: 'Bubble', Icon: ChartScatter },
];

const PIE_OPTIONS: readonly ChartTypeOption[] = [
  {
    id: 'pie-solid',
    label: 'Pie',
    Icon: ChartPie,
    enabled: true,
    variant: 'pie',
  },
  {
    id: 'pie-donut',
    label: 'Donut',
    Icon: Donut,
    enabled: true,
    variant: 'donut',
  },
];

const DISABLED_CHART_GROUPS: readonly {
  readonly label: string;
  readonly options: readonly ChartTypeOption[];
}[] = [
  {
    label: 'Line',
    options: [
      { id: 'line-1', label: 'Line', Icon: ChartLine },
      { id: 'line-2', label: 'Curved line', Icon: ChartLine },
      { id: 'line-3', label: 'Stepped line', Icon: ChartLine },
      { id: 'line-4', label: 'Spline', Icon: ChartLine },
    ],
  },
  {
    label: 'Bar',
    options: [
      { id: 'bar-1', label: 'Bar', Icon: ChartBar },
      { id: 'bar-2', label: 'Stacked bar', Icon: ChartBar },
      { id: 'bar-3', label: 'Grouped bar', Icon: ChartBar },
    ],
  },
  {
    label: 'Column',
    options: [
      { id: 'col-1', label: 'Column', Icon: ChartColumn },
      { id: 'col-2', label: 'Stacked column', Icon: ChartColumn },
      { id: 'col-3', label: 'Grouped column', Icon: ChartColumn },
    ],
  },
  {
    label: 'Area',
    options: [
      { id: 'area-1', label: 'Area', Icon: ChartArea },
      { id: 'area-2', label: 'Stacked area', Icon: ChartArea },
      { id: 'area-3', label: 'Spline area', Icon: ChartArea },
    ],
  },
  {
    label: 'Bubble',
    options: [{ id: 'bubble-1', label: 'Bubble', Icon: ChartScatter }],
  },
];

const TABLE_COLUMN_LABELS = [
  'Task',
  'Owner',
  'Status',
  'Type',
  'Priority',
] as const;

function SettingsSection({
  title,
  defaultOpen = false,
  children,
}: Readonly<{
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}>) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border bg-background rounded-md border"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/40 flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium"
        >
          {title}
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border border-t px-3 py-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

function ComingSoonIconButton({
  label,
  Icon,
  selected = false,
  enabled = false,
  onSelect,
}: Readonly<{
  label: string;
  Icon: ComponentType<{ className?: string }>;
  selected?: boolean;
  enabled?: boolean;
  onSelect?: () => void;
}>) {
  const button = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={!enabled}
      aria-label={label}
      aria-pressed={enabled ? selected : undefined}
      title={enabled ? label : undefined}
      onClick={enabled ? onSelect : undefined}
      className={cn(
        'size-9 shrink-0',
        enabled && 'cursor-pointer',
        selected &&
          'border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
      )}
    >
      <Icon className="size-4" />
    </Button>
  );

  if (enabled) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{button}</span>
      </TooltipTrigger>
      <TooltipContent side="top">Coming soon</TooltipContent>
    </Tooltip>
  );
}

function ChartTypeIconRow({
  options,
  pieVariant,
  onPieVariantChange,
}: Readonly<{
  options: readonly ChartTypeOption[];
  pieVariant: ChartPieVariant;
  // eslint-disable-next-line no-unused-vars
  onPieVariantChange: (variant: ChartPieVariant) => void;
}>) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const variant = option.variant;
        const selected = Boolean(
          option.enabled && variant != null && variant === pieVariant
        );
        return (
          <ComingSoonIconButton
            key={option.id}
            label={option.label}
            Icon={option.Icon}
            enabled={option.enabled}
            selected={selected}
            onSelect={variant ? () => onPieVariantChange(variant) : undefined}
          />
        );
      })}
    </div>
  );
}

function StaticSegmentedControl({
  options,
  selected,
}: Readonly<{
  options: readonly string[];
  selected: string;
}>) {
  return (
    <div
      className="bg-muted/50 flex w-full rounded-md p-0.5"
      aria-disabled="true"
    >
      {options.map((option) => (
        <span
          key={option}
          className={cn(
            'flex-1 rounded-sm px-2 py-1.5 text-center text-xs font-medium',
            option === selected
              ? 'bg-primary/15 text-primary shadow-sm'
              : 'text-muted-foreground'
          )}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

function StaticFieldLabel({
  children,
  withInfo = false,
}: Readonly<{ children: ReactNode; withInfo?: boolean }>) {
  return (
    <div className="text-muted-foreground mb-1.5 flex items-center gap-1 text-xs font-medium">
      {children}
      {withInfo ? <Info className="size-3.5 shrink-0 opacity-70" /> : null}
    </div>
  );
}

function StaticSelectStub({
  label,
  leading,
}: Readonly<{ label: string; leading?: ReactNode }>) {
  return (
    <div className="border-input bg-muted/20 text-muted-foreground flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm">
      {leading}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronDown className="size-3.5 shrink-0 opacity-60" />
    </div>
  );
}

function ChartTypeSection({
  pieVariant,
  onPieVariantChange,
}: Readonly<{
  pieVariant: ChartPieVariant;
  // eslint-disable-next-line no-unused-vars
  onPieVariantChange: (variant: ChartPieVariant) => void;
}>) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-xs font-medium">
          Most popular
        </p>
        <ChartTypeIconRow
          options={MOST_POPULAR_OPTIONS}
          pieVariant={pieVariant}
          onPieVariantChange={onPieVariantChange}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-xs font-medium">Pie</p>
        <ChartTypeIconRow
          options={PIE_OPTIONS}
          pieVariant={pieVariant}
          onPieVariantChange={onPieVariantChange}
        />
      </div>
      {DISABLED_CHART_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs font-medium">
            {group.label}
          </p>
          <ChartTypeIconRow
            options={group.options}
            pieVariant={pieVariant}
            onPieVariantChange={onPieVariantChange}
          />
        </div>
      ))}
    </div>
  );
}

function StaticColumnSelectMode() {
  return (
    <div>
      <StaticFieldLabel withInfo>Choose how to select columns</StaticFieldLabel>
      <StaticSegmentedControl
        options={['All at once', 'One by one']}
        selected="All at once"
      />
    </div>
  );
}

function StaticSubitemColumnsField() {
  return (
    <div>
      <StaticFieldLabel>Subitem columns</StaticFieldLabel>
      <StaticSelectStub label="No subitems column selected" />
    </div>
  );
}

function LabelsColumnSelect({
  labelField,
  onLabelFieldChange,
}: Readonly<{
  labelField: ChartsLabelFieldId;
  // eslint-disable-next-line no-unused-vars
  onLabelFieldChange: (field: ChartsLabelFieldId) => void;
}>) {
  const [open, setOpen] = useState(false);
  const selected =
    CHARTS_LIVE_LABEL_COLUMNS.find((column) => column.id === labelField) ??
    CHARTS_LIVE_LABEL_COLUMNS.find(
      (column) => column.id === DEFAULT_CHARTS_LABEL_FIELD
    );

  return (
    <div>
      <StaticFieldLabel>Columns</StaticFieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label="Select labels column"
            className="border-input bg-background h-auto min-h-9 w-full justify-between gap-2 px-2 py-1.5 font-normal"
          >
            <span className="bg-muted text-foreground inline-flex min-w-0 items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium">
              <LabelFieldIcon fieldId={selected?.id ?? 'status'} />
              <span className="truncate">{selected?.label ?? 'Status'}</span>
            </span>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Search columns…" />
            <CommandList>
              <CommandEmpty>No column found.</CommandEmpty>
              <CommandGroup>
                {CHARTS_LIVE_LABEL_COLUMNS.map((column) => (
                  <CommandItem
                    key={column.id}
                    value={column.label}
                    onSelect={() => {
                      onLabelFieldChange(column.id);
                      setOpen(false);
                    }}
                  >
                    <LabelFieldIcon fieldId={column.id} />
                    <span className="min-w-0 flex-1 truncate">
                      {column.label}
                    </span>
                    <Check
                      className={cn(
                        'size-3.5 shrink-0',
                        column.id === labelField ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function LabelFieldIcon({ fieldId }: Readonly<{ fieldId: string }>) {
  const className = 'size-3.5 shrink-0 opacity-70';
  switch (fieldId) {
    case 'board':
      return <LayoutGrid className={className} aria-hidden />;
    case 'group':
      return <Rows3 className={className} aria-hidden />;
    case 'name':
      return <TextCursorInput className={className} aria-hidden />;
    case 'owner':
      return <User className={className} aria-hidden />;
    case 'status':
      return (
        <span
          className="size-2.5 shrink-0 rounded-sm"
          style={{ backgroundColor: 'var(--chart-1)' }}
          aria-hidden
        />
      );
    case 'type':
      return <TextCursorInput className={className} aria-hidden />;
    case 'priority':
      return <Rows3 className={className} aria-hidden />;
    case 'dueDate':
      return <Calendar className={className} aria-hidden />;
    default:
      return null;
  }
}

function LabelsSection({
  labelField,
  onLabelFieldChange,
}: Readonly<{
  labelField: ChartsLabelFieldId;
  // eslint-disable-next-line no-unused-vars
  onLabelFieldChange: (field: ChartsLabelFieldId) => void;
}>) {
  return (
    <div className="flex flex-col gap-3">
      <StaticColumnSelectMode />
      <LabelsColumnSelect
        labelField={labelField}
        onLabelFieldChange={onLabelFieldChange}
      />
      <StaticSubitemColumnsField />
    </div>
  );
}

function ValuesSection() {
  return (
    <div className="pointer-events-none flex flex-col gap-3 opacity-90">
      <StaticColumnSelectMode />
      <div>
        <StaticFieldLabel>Columns</StaticFieldLabel>
        <StaticSelectStub
          label="Count items"
          leading={<List className="size-3.5 shrink-0 opacity-70" />}
        />
      </div>
      <StaticSubitemColumnsField />
      <div>
        <StaticFieldLabel>Calculation</StaticFieldLabel>
        <StaticSegmentedControl
          options={['Sum', 'Average', 'Median', 'Min', 'Max']}
          selected="Sum"
        />
      </div>
    </div>
  );
}

function CustomizeSection() {
  return (
    <div className="pointer-events-none flex flex-col gap-3 opacity-90">
      <div>
        <StaticFieldLabel>Labels</StaticFieldLabel>
        <div className="border-input bg-background text-foreground flex h-9 items-center justify-center gap-2 rounded-md border px-2.5 text-sm font-medium">
          <Paintbrush className="size-3.5 shrink-0 opacity-70" />
          Edit color, name and order
        </div>
      </div>
      <div>
        <StaticFieldLabel>Show value as</StaticFieldLabel>
        <StaticSegmentedControl options={['Value', '%']} selected="%" />
      </div>
      <div>
        <StaticFieldLabel withInfo>Sort by</StaticFieldLabel>
        <StaticSelectStub label="Values descending" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={false} disabled />
        Show only top/bottom items
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={false} disabled />
        <span className="flex items-center gap-1">
          Show empty values
          <Info className="text-muted-foreground size-3.5 opacity-70" />
        </span>
      </label>
    </div>
  );
}

function StaticCheckboxList({
  heading,
  allLabel,
  items,
}: Readonly<{
  heading?: string;
  allLabel: string;
  items: readonly string[];
}>) {
  return (
    <div className="pointer-events-none flex flex-col gap-2 opacity-90">
      {heading ? (
        <p className="text-muted-foreground text-xs font-medium">{heading}</p>
      ) : null}
      <label className="flex items-center justify-between gap-2 text-sm">
        <span>{allLabel}</span>
        <Checkbox checked disabled />
      </label>
      {items.map((item) => (
        <label
          key={item}
          className="flex items-center justify-between gap-2 text-sm"
        >
          <span>{item}</span>
          <Checkbox checked disabled />
        </label>
      ))}
    </div>
  );
}

function GroupsSection() {
  const statusLabels = BOARD_WORK_ITEM_STATUSES.map(
    (status) => STATUS_META[status]?.label ?? status
  );
  return (
    <StaticCheckboxList
      heading="Statuses"
      allLabel="All groups"
      items={statusLabels}
    />
  );
}

function ColumnsSection() {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Choose which columns to show</p>
      <StaticCheckboxList
        allLabel="All columns"
        items={[...TABLE_COLUMN_LABELS]}
      />
    </div>
  );
}

export function ChartsWidgetSettingsSidebar({
  pieVariant,
  onPieVariantChange,
  labelField = DEFAULT_CHARTS_LABEL_FIELD,
  onLabelFieldChange,
  className,
}: Readonly<ChartsWidgetSettingsSidebarProps>) {
  return (
    <TooltipProvider>
      <aside
        className={cn(
          'border-border bg-muted/20 flex h-full min-h-0 w-full max-w-xs shrink-0 flex-col border-l',
          className
        )}
        aria-label="Widget settings"
      >
        <div className="border-border flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
          <Settings className="text-muted-foreground size-4 shrink-0" />
          <h2 className="text-sm font-semibold tracking-tight">
            Widget settings
          </h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <SettingsSection title="Chart type" defaultOpen>
            <ChartTypeSection
              pieVariant={pieVariant}
              onPieVariantChange={onPieVariantChange}
            />
          </SettingsSection>
          <SettingsSection title="Labels">
            <LabelsSection
              labelField={labelField}
              onLabelFieldChange={(field) => onLabelFieldChange?.(field)}
            />
          </SettingsSection>
          <SettingsSection title="Values">
            <ValuesSection />
          </SettingsSection>
          <SettingsSection title="Customize">
            <CustomizeSection />
          </SettingsSection>
          <SettingsSection title="Groups">
            <GroupsSection />
          </SettingsSection>
          <SettingsSection title="Choose which columns to show">
            <ColumnsSection />
          </SettingsSection>
        </div>
      </aside>
    </TooltipProvider>
  );
}
