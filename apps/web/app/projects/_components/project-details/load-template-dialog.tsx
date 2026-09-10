'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import {
  RotateCcw,
  CheckCircle2,
  SlidersHorizontal,
} from '@repo/ui/lib/icons';

export interface TemplateFieldItem {
  key: string;
  category: string;
  property: {
    type: string;
    title: string;
    description: string;
    enum?: string[];
    format?: string;
    minimum?: number;
    maximum?: number;
    default?: unknown;
  };
}

export const TEMPLATE_FIELD_OPTIONS: TemplateFieldItem[] = [
  {
    key: 'moscowRating',
    category: 'Agile Prioritization',
    property: {
      type: 'string',
      title: 'MoSCoW Rating',
      description: 'Agile MoSCoW prioritization category',
      enum: ['Must', 'Should', 'Could', "Won't"],
    },
  },
  {
    key: 'acceptanceCriteria',
    category: 'Requirements & QA',
    property: {
      type: 'string',
      title: 'Acceptance Criteria',
      description:
        'Conditions that must be met for this work item to be accepted',
      format: 'multiline',
    },
  },
  {
    key: 'businessValue',
    category: 'Strategy & Value',
    property: {
      type: 'number',
      title: 'Business Value',
      description: 'Relative business value score (1-100)',
      minimum: 1,
      maximum: 100,
    },
  },
  {
    key: 'releaseNotesIncluded',
    category: 'Release Management',
    property: {
      type: 'boolean',
      title: 'Include in Release Notes',
      description:
        'Whether this item should be highlighted in customer release notes',
      default: false,
    },
  },
  {
    key: 'securityClassification',
    category: 'Security & Governance',
    property: {
      type: 'string',
      title: 'Security Classification',
      description:
        'Confidentiality and sensitivity level of this work item',
      enum: ['Public', 'Internal', 'Confidential', 'Restricted'],
    },
  },
  {
    key: 'complianceTier',
    category: 'Security & Governance',
    property: {
      type: 'string',
      title: 'Compliance Tier',
      description: 'Applicable regulatory compliance and audit tier',
      enum: ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'],
    },
  },
  {
    key: 'severity',
    category: 'Defects & QA',
    property: {
      type: 'string',
      title: 'Defect Severity',
      description:
        'Severity assessment for bug tracking and resolution priority',
      enum: ['Blocker', 'Critical', 'Major', 'Minor', 'Trivial'],
    },
  },
  {
    key: 'environment',
    category: 'DevOps & Deployment',
    property: {
      type: 'string',
      title: 'Target Environment',
      description:
        'Target deployment or testing environment',
      enum: ['Development', 'Staging', 'UAT', 'Production'],
    },
  },
];

const DEFAULT_STARTER_KEYS = [
  'moscowRating',
  'acceptanceCriteria',
  'businessValue',
  'releaseNotesIncluded',
];

/* eslint-disable no-unused-vars */
export interface LoadTemplateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly existingProperties?: Record<string, unknown>;
  readonly onAddTemplates: (selectedFields: Record<string, unknown>) => void;
}
/* eslint-enable no-unused-vars */

export function LoadTemplateDialog({
  open,
  onOpenChange,
  existingProperties = {},
  onAddTemplates,
}: Readonly<LoadTemplateDialogProps>) {
  const existingKeySet = useMemo(() => {
    return new Set(Object.keys(existingProperties));
  }, [existingProperties]);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      if (existingKeySet.size === 0) {
        // If project has no fields at all, default-select the core starter fields
        setSelectedKeys(new Set(DEFAULT_STARTER_KEYS));
      } else {
        // Otherwise start unselected so user can pick which missing fields they want
        setSelectedKeys(new Set());
      }
    }
  }, [open, existingKeySet]);

  const availableCount = useMemo(() => {
    return TEMPLATE_FIELD_OPTIONS.filter((t) => !existingKeySet.has(t.key))
      .length;
  }, [existingKeySet]);

  const alreadyAddedCount = useMemo(() => {
    return TEMPLATE_FIELD_OPTIONS.filter((t) => existingKeySet.has(t.key))
      .length;
  }, [existingKeySet]);

  const handleToggle = (key: string) => {
    if (existingKeySet.has(key)) return;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelectAllAvailable = () => {
    const unadded = TEMPLATE_FIELD_OPTIONS.filter(
      (t) => !existingKeySet.has(t.key)
    ).map((t) => t.key);
    setSelectedKeys(new Set(unadded));
  };

  const handleDeselectAll = () => {
    setSelectedKeys(new Set());
  };

  const handleConfirm = () => {
    if (selectedKeys.size === 0) return;

    const fieldsToAdd: Record<string, unknown> = {};
    for (const item of TEMPLATE_FIELD_OPTIONS) {
      if (selectedKeys.has(item.key) && !existingKeySet.has(item.key)) {
        fieldsToAdd[item.key] = item.property;
      }
    }

    onAddTemplates(fieldsToAdd);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary rounded-md p-1.5">
              <RotateCcw className="size-4" />
            </div>
            <DialogTitle>Load Field Templates</DialogTitle>
          </div>
          <DialogDescription>
            Select standard field templates to add to this project. Existing
            fields are preserved and will not be overwritten.
          </DialogDescription>

          <div className="flex items-center justify-between pt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">
                {selectedKeys.size} selected
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {availableCount} available to add
              </span>
              {alreadyAddedCount > 0 && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">
                    {alreadyAddedCount} already in project
                  </span>
                </>
              )}
            </div>

            {availableCount > 0 && (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllAvailable}
                  className="h-7 px-2 text-xs"
                >
                  Select All Available
                </Button>
                {selectedKeys.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6 overflow-y-auto max-h-[50vh]">
          {availableCount === 0 && (
            <div className="border-border/60 bg-muted/20 mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
              <span>
                All standard template fields are already configured in this
                project.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATE_FIELD_OPTIONS.map((item) => {
              const isAlreadyAdded = existingKeySet.has(item.key);
              const isSelected = selectedKeys.has(item.key);

              let cardStyle = 'border-border/60 bg-card/60 hover:border-border cursor-pointer';
              if (isAlreadyAdded) {
                cardStyle = 'border-border/50 bg-muted/20 opacity-70 cursor-not-allowed';
              } else if (isSelected) {
                cardStyle = 'border-primary/60 bg-primary/5 hover:border-primary cursor-pointer ring-1 ring-primary/20';
              }

              return (
                <div
                  key={item.key}
                  role="checkbox"
                  aria-checked={isAlreadyAdded || isSelected}
                  tabIndex={isAlreadyAdded ? -1 : 0}
                  onClick={() => handleToggle(item.key)}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleToggle(item.key);
                    }
                  }}
                  className={`border rounded-lg p-3.5 flex flex-col justify-between transition-all select-none ${cardStyle}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox
                          id={`template-checkbox-${item.key}`}
                          checked={isAlreadyAdded ? true : isSelected}
                          disabled={isAlreadyAdded}
                          onCheckedChange={() => handleToggle(item.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0"
                        />
                        <span className="font-semibold text-sm text-foreground truncate">
                          {item.property.title}
                        </span>
                      </div>

                      {isAlreadyAdded ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0 text-[10px] font-normal"
                        >
                          <CheckCircle2 className="mr-1 size-3" />
                          Added
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="shrink-0 font-mono text-[10px]"
                        >
                          {item.property.format
                            ? `${item.property.type}:${item.property.format}`
                            : item.property.type}
                        </Badge>
                      )}
                    </div>

                    <div className="text-muted-foreground font-mono text-[11px] mb-1.5 pl-6">
                      key: {item.key}
                    </div>

                    <p className="text-muted-foreground text-xs line-clamp-2 pl-6">
                      {item.property.description}
                    </p>
                  </div>

                  <div className="pt-2 pl-6 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="text-[10px] text-muted-foreground/80 font-medium">
                      {item.category}
                    </span>
                    {item.property.enum && (
                      <span className="text-[10px] text-muted-foreground/70">
                        {item.property.enum.length} options
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>

          <Button
            type="button"
            size="sm"
            disabled={selectedKeys.size === 0}
            onClick={handleConfirm}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-32"
          >
            <SlidersHorizontal className="mr-1.5 size-3.5" />
            Add Selected {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
