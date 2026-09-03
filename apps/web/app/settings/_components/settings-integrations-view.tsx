'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { IntegrationWire } from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import { Input } from '@repo/ui/components/ui/input';
import { Switch } from '@repo/ui/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { Plus, Search } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  INTEGRATION_FILTER_TABS,
  WORKSPACE_INTEGRATIONS,
  filterWorkspaceIntegrations,
  isCatalogConnected,
  integrationRowsForCatalog,
  type IntegrationFilterTab,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';
import { IntegrationDetailDialog } from '@/app/settings/_components/settings-integration-detail-dialog';
import { IntegrationIdentity } from '@/app/settings/_components/settings-integration-identity';
import { deleteWorkspaceIntegration } from '@/app/settings/_services/integrations.mutations.client';
import { errorMessage } from '@/lib/errors/error-message';

const FILTER_TAB_TRIGGER_CLASS =
  'text-muted-foreground data-[state=active]:text-foreground rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pb-3 pt-0 shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none';

type IntegrationMarketplaceCardProps = {
  readonly integration: WorkspaceIntegration;
  readonly connected: boolean;
  readonly isUpdating: boolean;
  /* eslint-disable no-unused-vars -- callback param name documents the value */
  readonly onConnectedChange: (connected: boolean) => void;
  readonly onView: () => void;
  /* eslint-enable no-unused-vars */
};

function IntegrationMarketplaceCard({
  integration,
  connected,
  isUpdating,
  onConnectedChange,
  onView,
}: Readonly<IntegrationMarketplaceCardProps>) {
  const isPlanned = integration.status === 'planned';

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
        <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-primary h-8 px-2"
            onClick={onView}
          >
            View integration
          </Button>
          <div className="flex items-center gap-2">
            {isPlanned ? (
              <Badge variant="outline" className="text-xs">
                Coming soon
              </Badge>
            ) : null}
            <Switch
              checked={connected}
              onCheckedChange={onConnectedChange}
              disabled={isPlanned || isUpdating}
              aria-label={`${integration.name} connected`}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type SettingsIntegrationsViewProps = {
  readonly initialIntegrations: IntegrationWire[];
  readonly initialCategoryFilter?: IntegrationFilterTab;
};

/**
 * Admin-only workspace integrations marketplace.
 */
export function SettingsIntegrationsView({
  initialIntegrations,
  initialCategoryFilter,
}: Readonly<SettingsIntegrationsViewProps>) {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<IntegrationFilterTab>(
    () => initialCategoryFilter ?? 'all'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [detailIntegration, setDetailIntegration] =
    useState<WorkspaceIntegration | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [updatingCatalogId, setUpdatingCatalogId] = useState<string | null>(
    null
  );
  const [listError, setListError] = useState<string | null>(null);

  const filteredIntegrations = useMemo(
    () =>
      filterWorkspaceIntegrations(
        WORKSPACE_INTEGRATIONS,
        activeFilter,
        searchQuery
      ),
    [activeFilter, searchQuery]
  );

  const openDetail = (integration: WorkspaceIntegration) => {
    setDetailIntegration(integration);
    setDetailOpen(true);
  };

  const handleConnectedChange = async (
    integration: WorkspaceIntegration,
    connected: boolean
  ) => {
    setListError(null);

    if (connected) {
      openDetail(integration);
      return;
    }

    const rows = integrationRowsForCatalog(
      initialIntegrations,
      integration.id
    ).filter((row) => row.status === 'active');

    if (rows.length === 0) {
      return;
    }

    setUpdatingCatalogId(integration.id);
    try {
      await Promise.all(rows.map((row) => deleteWorkspaceIntegration(row.id)));
      router.refresh();
    } catch (error) {
      setListError(errorMessage(error, 'Failed to disconnect integration'));
    } finally {
      setUpdatingCatalogId(null);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Integrations and connected apps
            </h1>
            <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
              Supercharge your workflow and connect the tools your team uses
              every day. Project-level GitHub and Jira stay on each
              project&apos;s Integrations tab.
            </p>
          </div>
          <Button type="button" variant="outline" disabled className="shrink-0">
            <Plus className="size-4" data-icon="inline-start" />
            Custom integration
          </Button>
        </div>

        {listError ? (
          <p className="text-destructive text-sm" role="alert">
            {listError}
          </p>
        ) : null}

        <Tabs
          value={activeFilter}
          onValueChange={(value) =>
            setActiveFilter(value as IntegrationFilterTab)
          }
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <TabsList className="h-auto w-full justify-start gap-4 overflow-x-auto rounded-none border-0 bg-transparent p-0 lg:w-auto">
              {INTEGRATION_FILTER_TABS.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(FILTER_TAB_TRIGGER_CLASS, 'shrink-0')}
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="relative w-full lg:max-w-xs">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search"
                className="pl-9"
                aria-label="Search integrations"
              />
            </div>
          </div>
        </Tabs>

        {filteredIntegrations.length === 0 ? (
          <div className="border-border rounded-lg border border-dashed px-6 py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No integrations match your search in this category.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredIntegrations.map((integration) => (
              <li key={integration.id}>
                <IntegrationMarketplaceCard
                  integration={integration}
                  connected={isCatalogConnected(
                    integration.id,
                    initialIntegrations
                  )}
                  isUpdating={updatingCatalogId === integration.id}
                  onConnectedChange={(connected) =>
                    void handleConnectedChange(integration, connected)
                  }
                  onView={() => openDetail(integration)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <IntegrationDetailDialog
        integration={detailIntegration}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        configuredRows={
          detailIntegration
            ? integrationRowsForCatalog(
                initialIntegrations,
                detailIntegration.id
              )
            : []
        }
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
