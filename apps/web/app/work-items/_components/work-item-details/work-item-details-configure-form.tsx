'use client';

import {
  BANNER_COLOR_OPTIONS,
  DETAILS_FIELD_LABELS,
  MORE_FIELDS_ITEM_LABELS,
  OPTIONAL_SECTION_LABELS,
  TITLE_ICON_OPTIONS,
  type WorkItemBannerColorSource,
  type WorkItemDetailsFieldId,
  type WorkItemDetailsOptionalSectionId,
  type WorkItemDetailsPreferences,
  type WorkItemMoreFieldsItemId,
  type WorkItemTitleIconSource,
} from '@/app/work-items/_helpers/work-item-details-preferences';
import { Label } from '@repo/ui/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@repo/ui/components/ui/radio-group';
import { Switch } from '@repo/ui/components/ui/switch';

type WorkItemDetailsConfigureFormProps = {
  readonly value: WorkItemDetailsPreferences;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onChange: (next: WorkItemDetailsPreferences) => void;
  readonly disabled?: boolean;
};

type PreferenceRadioOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly description: string;
};

function PreferenceRow({
  id,
  label,
  description,
  checked,
  disabled,
  onCheckedChange,
}: Readonly<{
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-muted-foreground text-xs">{description}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: Readonly<{
  readonly title: string;
  readonly description?: string;
}>) {
  return (
    <div className="space-y-0.5 pt-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
    </div>
  );
}

function PreferenceRadioGroup<T extends string>({
  idPrefix,
  value,
  disabled,
  options,
  onValueChange,
}: Readonly<{
  readonly idPrefix: string;
  readonly value: T;
  readonly disabled?: boolean;
  readonly options: readonly PreferenceRadioOption<T>[];
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onValueChange: (next: T) => void;
}>) {
  return (
    <RadioGroup
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        onValueChange(next as T);
      }}
      className="gap-3"
    >
      {options.map((option) => {
        const optionId = `${idPrefix}-${option.value}`;
        return (
          <div key={option.value} className="flex items-start gap-3">
            <RadioGroupItem
              value={option.value}
              id={optionId}
              className="mt-0.5"
            />
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor={optionId} className="text-sm font-medium">
                {option.label}
              </Label>
              <p className="text-muted-foreground text-xs">
                {option.description}
              </p>
            </div>
          </div>
        );
      })}
    </RadioGroup>
  );
}

export function WorkItemDetailsConfigureForm({
  value,
  onChange,
  disabled = false,
}: Readonly<WorkItemDetailsConfigureFormProps>) {
  const patch = (partial: Partial<WorkItemDetailsPreferences>) => {
    onChange({ ...value, ...partial });
  };

  const setSection = (
    key: WorkItemDetailsOptionalSectionId,
    checked: boolean
  ) => {
    patch({
      sections: { ...value.sections, [key]: checked },
    });
  };

  const setDetailsField = (key: WorkItemDetailsFieldId, checked: boolean) => {
    patch({
      detailsFields: { ...value.detailsFields, [key]: checked },
    });
  };

  const setMoreFieldsItem = (
    key: WorkItemMoreFieldsItemId,
    checked: boolean
  ) => {
    patch({
      moreFieldsItems: { ...value.moreFieldsItems, [key]: checked },
    });
  };

  const optionalSectionIds = Object.keys(
    OPTIONAL_SECTION_LABELS
  ) as WorkItemDetailsOptionalSectionId[];
  const detailsFieldIds = Object.keys(
    DETAILS_FIELD_LABELS
  ) as WorkItemDetailsFieldId[];
  const moreFieldsItemIds = Object.keys(
    MORE_FIELDS_ITEM_LABELS
  ) as WorkItemMoreFieldsItemId[];

  return (
    <div className="divide-border space-y-1 divide-y">
      <div className="space-y-3 pb-4">
        <SectionHeading
          title="Banner color"
          description="Choose how the summary banner is tinted."
        />
        <PreferenceRadioGroup
          idPrefix="wi-banner"
          value={value.bannerColor}
          disabled={disabled}
          options={BANNER_COLOR_OPTIONS}
          onValueChange={(next: WorkItemBannerColorSource) => {
            patch({ bannerColor: next });
          }}
        />
      </div>

      <div className="space-y-3 py-4">
        <SectionHeading
          title="Title icon"
          description="Icon shown to the left of the title."
        />
        <PreferenceRadioGroup
          idPrefix="wi-icon"
          value={value.titleIcon}
          disabled={disabled}
          options={TITLE_ICON_OPTIONS}
          onValueChange={(next: WorkItemTitleIconSource) => {
            patch({ titleIcon: next });
          }}
        />
      </div>

      <div className="space-y-1 py-4">
        <SectionHeading
          title="Optional sections"
          description="Hide whole blocks when you do not need them. Description stays available."
        />
        {optionalSectionIds.map((id) => (
          <PreferenceRow
            key={id}
            id={`wi-section-${id}`}
            label={OPTIONAL_SECTION_LABELS[id]}
            checked={value.sections[id]}
            disabled={disabled}
            onCheckedChange={(checked) => setSection(id, checked)}
          />
        ))}
      </div>

      <div className="space-y-1 py-4">
        <SectionHeading
          title="Details fields"
          description="Only apply when Details is shown."
        />
        {detailsFieldIds.map((id) => (
          <PreferenceRow
            key={id}
            id={`wi-details-${id}`}
            label={DETAILS_FIELD_LABELS[id]}
            checked={value.detailsFields[id]}
            disabled={disabled || !value.sections.details}
            onCheckedChange={(checked) => setDetailsField(id, checked)}
          />
        ))}
      </div>

      <div className="space-y-1 pt-4">
        <SectionHeading
          title="More fields items"
          description="Only apply when More fields is shown."
        />
        {moreFieldsItemIds.map((id) => (
          <PreferenceRow
            key={id}
            id={`wi-more-${id}`}
            label={MORE_FIELDS_ITEM_LABELS[id]}
            checked={value.moreFieldsItems[id]}
            disabled={disabled || !value.sections.moreFields}
            onCheckedChange={(checked) => setMoreFieldsItem(id, checked)}
          />
        ))}
      </div>
    </div>
  );
}
