'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProjectAiModelOption } from '@repo/types/api/v1';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  ChevronDown,
  ExternalLink,
  Pencil,
  Plus,
  Star,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';
import { projectAiProviderGroups } from '@/app/projects/_helpers/project-ai-catalog';
import type { ConfigurableCatalogId } from '@/app/settings/_components/settings-integration-catalog';

export type ProjectAiModelsAccordionProps = {
  readonly models: readonly ProjectAiModelOption[];
  readonly aiBindingIds: readonly string[];
  readonly defaultAiIntegrationId: string | null;
  readonly disabled?: boolean;
  // eslint-disable-next-line no-unused-vars -- selection callbacks
  readonly onToggleModel: (modelId: string, checked: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- selection callbacks
  readonly onSetDefault: (modelId: string) => void;
  // eslint-disable-next-line no-unused-vars -- mint callbacks
  readonly onCreateForCatalog: (catalogId: ConfigurableCatalogId) => void;
  // eslint-disable-next-line no-unused-vars -- edit callbacks
  readonly onEditProjectModel: (model: ProjectAiModelOption) => void;
};

type ScopeFilter = 'all' | 'organization' | 'project';

function scopeLabel(scope: string): string {
  return scope === 'project' ? 'Project' : 'Organization';
}

export function ProjectAiModelsAccordion({
  models,
  aiBindingIds,
  defaultAiIntegrationId,
  disabled = false,
  onToggleModel,
  onSetDefault,
  onCreateForCatalog,
  onEditProjectModel,
}: Readonly<ProjectAiModelsAccordionProps>) {
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [openProviders, setOpenProviders] = useState<Record<string, boolean>>(
    {}
  );

  const selected = useMemo(() => new Set(aiBindingIds), [aiBindingIds]);
  const providerGroups = projectAiProviderGroups();

  const ownerOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const model of models) {
      if (model.created_by && model.created_by_name) {
        names.set(model.created_by, model.created_by_name);
      }
    }
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [models]);

  const filteredModels = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return models.filter((model) => {
      if (scopeFilter !== 'all' && model.scope !== scopeFilter) {
        return false;
      }
      if (ownerFilter !== 'all' && model.created_by !== ownerFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        model.display_label,
        model.name,
        model.model,
        model.provider,
        model.created_by_name ?? '',
        scopeLabel(model.scope),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [models, search, scopeFilter, ownerFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <div className="grid min-w-0 flex-1 gap-1.5">
          <Label htmlFor="project-ai-search">Search</Label>
          <Input
            id="project-ai-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search models, owners…"
            disabled={disabled}
          />
        </div>
        <div className="grid w-full gap-1.5 sm:max-w-[10rem]">
          <Label htmlFor="project-ai-scope-filter">Scope</Label>
          <Select
            value={scopeFilter}
            onValueChange={(value) => setScopeFilter(value as ScopeFilter)}
            disabled={disabled}
          >
            <SelectTrigger id="project-ai-scope-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scopes</SelectItem>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="project">Project</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid w-full gap-1.5 sm:max-w-[14rem]">
          <Label htmlFor="project-ai-owner-filter">Owner</Label>
          <Select
            value={ownerFilter}
            onValueChange={setOwnerFilter}
            disabled={disabled}
          >
            <SelectTrigger id="project-ai-owner-filter">
              <SelectValue placeholder="All owners" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All owners</SelectItem>
              {ownerOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {providerGroups.map((group) => {
          const groupModels = filteredModels.filter(
            (model) => model.provider === group.provider
          );
          const boundCount = groupModels.filter((model) =>
            selected.has(model.id)
          ).length;
          const isOpen = openProviders[group.provider] ?? boundCount > 0;

          return (
            <Collapsible
              key={group.provider}
              open={isOpen}
              onOpenChange={(next) =>
                setOpenProviders((current) => ({
                  ...current,
                  [group.provider]: next,
                }))
              }
              className="border-border rounded-lg border"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto min-w-0 flex-1 justify-start gap-2 px-1 py-1"
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 shrink-0 transition-transform',
                        isOpen ? 'rotate-0' : '-rotate-90'
                      )}
                    />
                    <span className="truncate font-medium">{group.label}</span>
                    <Badge variant="secondary" className="shrink-0">
                      {boundCount}/{groupModels.length}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8 shrink-0"
                  disabled={disabled}
                  aria-label={`Add ${group.label} model`}
                  onClick={() => onCreateForCatalog(group.catalogId)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>

              <CollapsibleContent className="border-border border-t">
                {groupModels.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-3 text-xs">
                    No models in this group for the current filters.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[40rem] text-sm">
                      <thead>
                        <tr className="text-muted-foreground border-border border-b text-left text-xs">
                          <th className="px-3 py-2 font-medium">Enable</th>
                          <th className="px-3 py-2 font-medium">Label</th>
                          <th className="px-3 py-2 font-medium">Model</th>
                          <th className="px-3 py-2 font-medium">Scope</th>
                          <th className="px-3 py-2 font-medium">Owner</th>
                          <th className="px-3 py-2 font-medium">Default</th>
                          <th className="px-3 py-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupModels.map((model) => {
                          const isSelected = selected.has(model.id);
                          const isDefault = defaultAiIntegrationId === model.id;
                          const isProject = model.scope === 'project';
                          return (
                            <tr
                              key={model.id}
                              className="border-border border-b last:border-b-0"
                            >
                              <td className="px-3 py-2">
                                <Checkbox
                                  checked={isSelected}
                                  disabled={disabled}
                                  onCheckedChange={(value) =>
                                    onToggleModel(model.id, value === true)
                                  }
                                  aria-label={`Enable ${model.display_label}`}
                                />
                              </td>
                              <td className="max-w-[10rem] px-3 py-2">
                                <TruncatedText className="font-medium">
                                  {model.display_label}
                                </TruncatedText>
                              </td>
                              <td className="max-w-[10rem] px-3 py-2">
                                <TruncatedText className="text-muted-foreground">
                                  {model.model}
                                </TruncatedText>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant="outline">
                                  {scopeLabel(model.scope)}
                                </Badge>
                              </td>
                              <td className="max-w-[8rem] px-3 py-2">
                                <TruncatedText className="text-muted-foreground">
                                  {model.created_by_name ?? 'Unknown'}
                                </TruncatedText>
                              </td>
                              <td className="px-3 py-2">
                                {isSelected ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    disabled={disabled}
                                    aria-label={
                                      isDefault
                                        ? `${model.display_label} is the project default`
                                        : `Set ${model.display_label} as project default`
                                    }
                                    aria-pressed={isDefault}
                                    onClick={() => onSetDefault(model.id)}
                                  >
                                    <Star
                                      className={cn(
                                        'size-4',
                                        isDefault &&
                                          'fill-current text-amber-500'
                                      )}
                                    />
                                  </Button>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {isProject ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="size-8"
                                    disabled={disabled}
                                    aria-label={`Edit ${model.display_label}`}
                                    onClick={() => onEditProjectModel(model)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2"
                                    asChild
                                  >
                                    <Link
                                      href={chatAiAgentsIntegrationsHref()}
                                      className="inline-flex items-center gap-1"
                                    >
                                      Settings
                                      <ExternalLink className="size-3.5" />
                                    </Link>
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
