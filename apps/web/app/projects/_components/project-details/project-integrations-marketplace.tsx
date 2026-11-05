'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Input } from '@repo/ui/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Search } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { WorkspaceIntegration } from '@/app/settings/_components/settings-integration-catalog';
import { IntegrationIdentity } from '@/app/settings/_components/settings-integration-identity';
import {
  GitHubLogo,
  JiraLogo,
} from '@/app/projects/_components/project-details/integration-brand-logos';
import { GithubSettingsCard } from '@/app/projects/_components/project-details/github-settings-card';
import { JiraSettingsCard } from '@/app/projects/_components/project-details/jira-settings-card';
import { ProjectAiModelsCard } from '@/app/projects/_components/project-details/project-ai-models-card';
import { ProjectIntegrationsSummaryBar } from '@/app/projects/_components/project-details/project-integrations-summary-bar';
import {
  INTEGRATION_PROVIDER_NONE,
  IntegrationProviderRadioGroup,
} from '@/app/projects/_components/project-integration-provider-radio';
import {
  PROJECT_INTEGRATION_FILTER_TABS,
  filterProjectMarketplaceCatalog,
  resolveMarketplaceSectionVisibility,
  type ProjectIntegrationFilterTab,
} from '@/app/projects/_helpers/project-integrations-marketplace.shared';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

const FILTER_TAB_TRIGGER_CLASS =
  'text-muted-foreground data-[state=active]:text-foreground rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none';

const JIRA_PROVIDER = 'jira';
const GITHUB_PROVIDER = 'github';

function projectHasGithubLink(project: Project): boolean {
  return Boolean(project.github_repo || project.github_connection_id);
}

function projectHasJiraLink(project: Project): boolean {
  return Boolean(project.jira_connection_id || project.jira_project_key);
}

function ComingSoonCatalogCard({
  integration,
}: Readonly<{ integration: WorkspaceIntegration }>) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-0 pb-3">
        <IntegrationIdentity
          name={integration.name}
          websiteUrl={integration.websiteUrl}
          variant="card"
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-0">
        <p className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
          {integration.description}
        </p>
        <div className="border-border flex items-center justify-end border-t pt-4">
          <Badge variant="outline" className="text-xs">
            Coming soon
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

type ProviderChangeHandler = {
  // eslint-disable-next-line no-unused-vars -- callback signature for radio changes
  (next: string): void;
};

function useLinkedProviderSelection(
  linked: boolean,
  linkedValue: string
): [string, ProviderChangeHandler] {
  const [provider, setProvider] = useState(() =>
    linked ? linkedValue : INTEGRATION_PROVIDER_NONE
  );

  useEffect(() => {
    setProvider(linked ? linkedValue : INTEGRATION_PROVIDER_NONE);
  }, [linked, linkedValue]);

  const onProviderChange = (next: string) => {
    if (next === INTEGRATION_PROVIDER_NONE && linked) {
      // Keep the linked provider selected; disconnect / clear from the card.
      setProvider(linkedValue);
      return;
    }
    setProvider(next);
  };

  return [provider, onProviderChange];
}

function MarketplaceFilterBar({
  activeFilter,
  searchQuery,
  onFilterChange,
  onSearchChange,
}: Readonly<{
  activeFilter: ProjectIntegrationFilterTab;
  searchQuery: string;
  // eslint-disable-next-line no-unused-vars -- callback param documents next filter
  onFilterChange: (next: ProjectIntegrationFilterTab) => void;
  // eslint-disable-next-line no-unused-vars -- callback param documents next query
  onSearchChange: (next: string) => void;
}>) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Project integrations
        </h2>
        <div className="relative w-full shrink-0 sm:max-w-xs">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search"
            className="pl-9"
            aria-label="Search project integrations"
          />
        </div>
      </div>

      <Tabs
        value={activeFilter}
        onValueChange={(value) =>
          onFilterChange(value as ProjectIntegrationFilterTab)
        }
      >
        <TabsList className="h-auto w-full flex-wrap justify-start gap-x-4 gap-y-1 rounded-none border-0 bg-transparent p-0">
          {PROJECT_INTEGRATION_FILTER_TABS.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className={cn(FILTER_TAB_TRIGGER_CLASS, 'cursor-pointer')}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
  );
}

function SourceControlSection({
  project,
  provider,
  onProviderChange,
  currentUserId,
  currentUserRole,
  canEditProject,
}: Readonly<{
  project: Project;
  provider: string;
  // eslint-disable-next-line no-unused-vars -- callback param documents next value
  onProviderChange: (next: string) => void;
  currentUserId?: string | null;
  currentUserRole?: string | null;
  canEditProject: boolean;
}>) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Source control</h3>
        <p className="text-muted-foreground text-xs">
          One repository host per project. Disconnect below to choose None after
          a link is saved.
        </p>
      </div>
      <IntegrationProviderRadioGroup
        idPrefix={`project-${project.id}-sc`}
        ariaLabel="Source control provider"
        value={provider}
        onValueChange={onProviderChange}
        noneDescription="No source control linked to this project."
        options={[
          {
            value: GITHUB_PROVIDER,
            title: 'GitHub',
            description:
              'Link pull requests, commits, and branches on work items.',
            logo: <GitHubLogo />,
          },
        ]}
      />
      {provider === GITHUB_PROVIDER ? (
        <GithubSettingsCard
          project={project}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          canEditProject={canEditProject}
        />
      ) : null}
    </section>
  );
}

function ProjectManagementSection({
  project,
  provider,
  onProviderChange,
}: Readonly<{
  project: Project;
  provider: string;
  // eslint-disable-next-line no-unused-vars -- callback param documents next value
  onProviderChange: (next: string) => void;
}>) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Project management</h3>
        <p className="text-muted-foreground text-xs">
          One project management provider per Alice project. Disconnect below to
          choose None after a link is saved.
        </p>
      </div>
      <IntegrationProviderRadioGroup
        idPrefix={`project-${project.id}-pm`}
        ariaLabel="Project management provider"
        value={provider}
        onValueChange={onProviderChange}
        noneDescription="No project management tool linked to this project."
        options={[
          {
            value: JIRA_PROVIDER,
            title: 'Jira',
            description:
              'Connect Atlassian OAuth and import issues into this project.',
            logo: <JiraLogo />,
          },
        ]}
      />
      {provider === JIRA_PROVIDER ? (
        <JiraSettingsCard project={project} />
      ) : null}
    </section>
  );
}

function ComingSoonCatalogSection({
  catalogItems,
}: Readonly<{ catalogItems: readonly WorkspaceIntegration[] }>) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">More integrations</h3>
        <p className="text-muted-foreground text-xs">
          Additional providers stay organization-scoped until they ship for
          projects.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {catalogItems.map((integration) => (
          <li key={integration.id}>
            <ComingSoonCatalogCard integration={integration} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export type ProjectIntegrationsMarketplaceProps = {
  readonly project: Project;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
  readonly canEditProject?: boolean;
};

/**
 * Settings-style marketplace chrome for project Integrations (SC/PM radios + AI).
 */
export function ProjectIntegrationsMarketplace({
  project,
  currentUserId,
  currentUserRole,
  canEditProject = true,
}: Readonly<ProjectIntegrationsMarketplaceProps>) {
  const [activeFilter, setActiveFilter] =
    useState<ProjectIntegrationFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const githubLinked = projectHasGithubLink(project);
  const jiraLinked = projectHasJiraLink(project);
  const [sourceControlProvider, setSourceControlProvider] =
    useLinkedProviderSelection(githubLinked, GITHUB_PROVIDER);
  const [projectManagementProvider, setProjectManagementProvider] =
    useLinkedProviderSelection(jiraLinked, JIRA_PROVIDER);

  const catalogItems = useMemo(
    () => filterProjectMarketplaceCatalog(activeFilter, searchQuery),
    [activeFilter, searchQuery]
  );

  const visibility = useMemo(
    () =>
      resolveMarketplaceSectionVisibility(
        activeFilter,
        searchQuery,
        catalogItems.length
      ),
    [activeFilter, searchQuery, catalogItems.length]
  );

  return (
    <div className="space-y-6">
      <ProjectIntegrationsSummaryBar projectId={project.id} />

      <MarketplaceFilterBar
        activeFilter={activeFilter}
        searchQuery={searchQuery}
        onFilterChange={setActiveFilter}
        onSearchChange={setSearchQuery}
      />

      {!visibility.hasVisibleContent ? (
        <div className="border-border rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No integrations match your search in this category.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {visibility.showSourceControl ? (
            <SourceControlSection
              project={project}
              provider={sourceControlProvider}
              onProviderChange={setSourceControlProvider}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              canEditProject={canEditProject}
            />
          ) : null}

          {visibility.showProjectManagement ? (
            <ProjectManagementSection
              project={project}
              provider={projectManagementProvider}
              onProviderChange={setProjectManagementProvider}
            />
          ) : null}

          {visibility.showAiAgents ? (
            <section className="space-y-4">
              <ProjectAiModelsCard
                projectId={project.id}
                canEdit={canEditProject}
              />
            </section>
          ) : null}

          {visibility.showCatalog && catalogItems.length > 0 ? (
            <ComingSoonCatalogSection catalogItems={catalogItems} />
          ) : null}
        </div>
      )}
    </div>
  );
}
