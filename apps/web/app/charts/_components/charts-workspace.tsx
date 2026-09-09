'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LayoutItem } from 'react-grid-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { BarChart3, X } from '@repo/ui/lib/icons';
import { SearchInput } from '@/components/search-input';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { ChartsAddWidgetMenu } from '@/app/charts/_components/charts-add-widget-menu';
import {
  ChartsBoardCanvas,
  appendChartWidget,
  clearPersistedChartBoard,
  duplicateChartWidget,
  persistChartBoard,
  readStoredChartBoard,
  removeChartWidget,
  renameChartWidget,
  updateChartWidgetFilters,
} from '@/app/charts/_components/charts-board-canvas';
import {
  ChartsFilterDialog,
  type ChartsFilterDraft,
} from '@/app/charts/_components/charts-filter-dialog';
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
  ChartBoardWidgetInstance,
  ChartWidgetTypeId,
} from '@/app/charts/_components/charts.types';
import type { ChartsWidgetFilterDraft } from '@/app/charts/_components/charts-sample.data';

type ChartsWorkspaceProps = {
  readonly search: string;
  readonly ownership: ChartBoardOwnershipFilter;
  readonly status: ChartBoardStatusFilter;
};

export function ChartsWorkspace({
  search,
  ownership,
  status,
}: Readonly<ChartsWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);

  const [instances, setInstances] = useState<ChartBoardWidgetInstance[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readStoredChartBoard();
    setInstances(stored.instances);
    setLayout(stored.layout);
    setHydrated(true);
  }, []);

  const hasActiveFilters = ownership !== 'all' || status !== 'all';

  const replaceQuery = useCallback(
    // eslint-disable-next-line no-unused-vars
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams]
  );

  const handleApplyFilters = useCallback(
    (draft: ChartsFilterDraft) => {
      replaceQuery((params) => {
        if (draft.ownership === 'all') {
          params.delete('ownership');
        } else {
          params.set('ownership', draft.ownership);
        }
        if (draft.status === 'all') {
          params.delete('status');
        } else {
          params.set('status', draft.status);
        }
      });
    },
    [replaceQuery]
  );

  const handleClearFilters = useCallback(() => {
    replaceQuery((params) => {
      params.delete('ownership');
      params.delete('status');
    });
  }, [replaceQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const commitBoard = useCallback(
    (next: { instances: ChartBoardWidgetInstance[]; layout: LayoutItem[] }) => {
      setInstances(next.instances);
      setLayout(next.layout);
      if (hydrated) {
        persistChartBoard(next.instances, next.layout);
      }
    },
    [hydrated]
  );

  const commitInstances = useCallback(
    (nextInstances: ChartBoardWidgetInstance[]) => {
      setInstances(nextInstances);
      if (hydrated) {
        persistChartBoard(nextInstances, layout);
      }
    },
    [hydrated, layout]
  );

  const handleSelectWidget = useCallback(
    (typeId: ChartWidgetTypeId) => {
      commitBoard(appendChartWidget(typeId, instances, layout));
    },
    [commitBoard, instances, layout]
  );

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutItem[]) => {
      setLayout(nextLayout);
      if (hydrated) {
        persistChartBoard(instances, nextLayout);
      }
    },
    [hydrated, instances]
  );

  const handleClearBoard = useCallback(() => {
    setInstances([]);
    setLayout([]);
    clearPersistedChartBoard();
  }, []);

  const handleRemoveWidget = useCallback(
    (instanceId: string) => {
      commitBoard(removeChartWidget(instanceId, instances, layout));
    },
    [commitBoard, instances, layout]
  );

  const handleDuplicateWidget = useCallback(
    (instanceId: string) => {
      commitBoard(duplicateChartWidget(instanceId, instances, layout));
    },
    [commitBoard, instances, layout]
  );

  const handleRenameWidget = useCallback(
    (instanceId: string, title: string) => {
      commitInstances(renameChartWidget(instanceId, title, instances));
    },
    [commitInstances, instances]
  );

  const handleFiltersChange = useCallback(
    (
      instanceId: string,
      filters: ChartsWidgetFilterDraft | null | undefined
    ) => {
      commitInstances(
        updateChartWidgetFilters(instanceId, filters ?? null, instances)
      );
    },
    [commitInstances, instances]
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            onClear={handleClearSearch}
            placeholder="Search charts…"
          />
          <ChartsFilterDialog
            ownership={ownership}
            status={status}
            hasActiveFilters={hasActiveFilters}
            onApplyFilters={handleApplyFilters}
          />
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
            >
              Clear filters
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start">
          <ChartsAddWidgetMenu onSelectWidget={handleSelectWidget} />
        </div>
      </div>

      <Card className="border-border bg-card/50 flex min-h-0 flex-1 flex-col overflow-hidden backdrop-blur-md">
        <CardHeader className="shrink-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <BarChart3 className="text-primary size-5" />
            Charts
          </CardTitle>
          <CardDescription>
            Drag and resize widgets like Overview. Persistence to the API comes
            next — layout is saved locally for now.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-0">
          <ChartsBoardCanvas
            instances={instances}
            layout={layout}
            hydrated={hydrated}
            onLayoutChange={handleLayoutChange}
            onRemoveWidget={handleRemoveWidget}
            onDuplicateWidget={handleDuplicateWidget}
            onRenameWidget={handleRenameWidget}
            onFiltersChange={handleFiltersChange}
            onClearBoard={handleClearBoard}
          />
        </CardContent>
      </Card>
    </div>
  );
}
