'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { LayoutItem } from 'react-grid-layout';
import { Button } from '@repo/ui/components/ui/button';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { BarChart3, ChevronLeft, ChevronRight } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  ChartsBoardCanvas,
  reconcileChartBoardLayout,
  saveChartWidgetMeta,
  updateChartWidgetDisplaySettings,
  updateChartWidgetFilters,
  updateChartWidgetLabelField,
  updateChartWidgetPieVariant,
  updateChartWidgetViewMode,
  duplicateChartWidget,
  removeChartWidget,
} from '@/app/charts/_components/charts-board-canvas';
import type {
  ChartBoardWidgetInstance,
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartWidgetDisplaySettingsPatch,
  ChartWidgetViewMode,
  ChartWorkspaceRecord,
} from '@/app/charts/_components/charts.types';
import { syncChartWorkspaceToApi } from '@/app/charts/_services/charts.mutations.client';
import { resolveChartsDescription } from '@/app/charts/_helpers/charts-description';

type DashboardChartsSliderProps = {
  readonly slides: readonly ChartWorkspaceRecord[];
  readonly accessibleProjects?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly accessibleSprints?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly projectId: string;
  }>;
};

function DashboardChartsSliderEmpty() {
  return (
    <div className="border-border text-muted-foreground flex min-h-72 flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed px-6 py-12 text-center">
      <BarChart3 className="size-10 stroke-[1.5]" aria-hidden />
      <div className="space-y-1">
        <p className="text-foreground text-sm font-medium">
          No chart workspaces on the Overview yet
        </p>
        <p className="mx-auto max-w-md text-sm leading-relaxed">
          Pin workspaces from Charts → Edit → Show on dashboard to build this
          slider.
        </p>
      </div>
      <Button asChild className="cursor-pointer">
        <Link href="/charts">Open Charts</Link>
      </Button>
    </div>
  );
}

function DashboardSlideBoard({
  slide,
  accessibleProjects,
  accessibleSprints,
}: Readonly<{
  slide: ChartWorkspaceRecord;
  accessibleProjects: ReadonlyArray<{ id: string; name: string }>;
  accessibleSprints: ReadonlyArray<{
    id: string;
    name: string;
    projectId: string;
  }>;
}>) {
  const [instances, setInstances] = useState(slide.instances);
  const [layout, setLayout] = useState(() =>
    reconcileChartBoardLayout(slide.instances, slide.layout)
  );
  const layoutLocked = (slide.ownership ?? 'mine') === 'shared';

  const persist = (
    nextInstances: ChartBoardWidgetInstance[],
    nextLayout: LayoutItem[]
  ) => {
    if (layoutLocked) {
      return;
    }
    const updated: ChartWorkspaceRecord = {
      ...slide,
      instances: nextInstances,
      layout: nextLayout,
      updatedAt: new Date().toISOString(),
    };
    syncChartWorkspaceToApi(updated).catch(() => {});
  };

  return (
    <ChartsBoardCanvas
      instances={instances}
      layout={layout}
      hydrated
      overviewChrome
      layoutLocked={layoutLocked}
      accessibleProjects={accessibleProjects}
      accessibleSprints={accessibleSprints}
      onLayoutChange={(next) => {
        const reconciled = reconcileChartBoardLayout(instances, next);
        setLayout(reconciled);
        persist(instances, reconciled);
      }}
      onRemoveWidget={(instanceId) => {
        if (layoutLocked) {
          return;
        }
        const next = removeChartWidget(instanceId, instances, layout);
        setInstances(next.instances);
        setLayout(next.layout);
        persist(next.instances, next.layout);
      }}
      onDuplicateWidget={(instanceId) => {
        if (layoutLocked) {
          return;
        }
        const next = duplicateChartWidget(instanceId, instances, layout);
        setInstances(next.instances);
        setLayout(next.layout);
        persist(next.instances, next.layout);
      }}
      onRenameWidget={(instanceId, meta) => {
        if (layoutLocked) {
          return;
        }
        const nextInstances = saveChartWidgetMeta(instanceId, meta, instances);
        setInstances(nextInstances);
        persist(nextInstances, layout);
      }}
      onFiltersChange={(instanceId, filters) => {
        if (layoutLocked) {
          return;
        }
        const nextInstances = updateChartWidgetFilters(
          instanceId,
          filters,
          instances
        );
        setInstances(nextInstances);
        persist(nextInstances, layout);
      }}
      onViewModeChange={(
        instanceId,
        viewMode: ChartWidgetViewMode,
        focusedSliceKey
      ) => {
        const nextInstances = updateChartWidgetViewMode(
          instanceId,
          viewMode,
          focusedSliceKey,
          instances
        );
        setInstances(nextInstances);
        if (!layoutLocked) {
          persist(nextInstances, layout);
        }
      }}
      onPieVariantChange={(instanceId, pieVariant: ChartPieVariant) => {
        if (layoutLocked) {
          return;
        }
        const nextInstances = updateChartWidgetPieVariant(
          instanceId,
          pieVariant,
          instances
        );
        setInstances(nextInstances);
        persist(nextInstances, layout);
      }}
      onLabelFieldChange={(instanceId, labelField: ChartsLabelFieldId) => {
        if (layoutLocked) {
          return;
        }
        const nextInstances = updateChartWidgetLabelField(
          instanceId,
          labelField,
          instances
        );
        setInstances(nextInstances);
        persist(nextInstances, layout);
      }}
      onDisplaySettingsChange={(
        instanceId,
        patch: ChartWidgetDisplaySettingsPatch
      ) => {
        if (layoutLocked) {
          return;
        }
        const nextInstances = updateChartWidgetDisplaySettings(
          instanceId,
          patch,
          instances
        );
        setInstances(nextInstances);
        persist(nextInstances, layout);
      }}
    />
  );
}

export function DashboardChartsSlider({
  slides,
  accessibleProjects = [],
  accessibleSprints = [],
}: Readonly<DashboardChartsSliderProps>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState<ReadonlySet<string>>(
    () => new Set(slides[0] ? [slides[0].id] : [])
  );

  const safeIndex = Math.min(activeIndex, Math.max(slides.length - 1, 0));
  const activeSlide = slides[safeIndex] ?? null;

  const slideTabs = useMemo(
    () =>
      slides.map((slide, index) => ({
        id: slide.id,
        title: slide.title,
        description: resolveChartsDescription({
          description: slide.description,
          title: slide.title,
        }),
        index,
      })),
    [slides]
  );

  if (slides.length === 0) {
    return <DashboardChartsSliderEmpty />;
  }

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(index, slides.length - 1));
    setActiveIndex(next);
    const slide = slides[next];
    if (slide) {
      setVisited((previous) => new Set([...previous, slide.id]));
    }
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {slideTabs.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={tab.index === safeIndex ? 'default' : 'outline'}
              size="sm"
              className="max-w-56 cursor-pointer"
              title={tab.description}
              onClick={() => goTo(tab.index)}
            >
              <TruncatedText className="min-w-0">{tab.title}</TruncatedText>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            disabled={safeIndex <= 0}
            aria-label="Previous workspace"
            onClick={() => goTo(safeIndex - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            disabled={safeIndex >= slides.length - 1}
            aria-label="Next workspace"
            onClick={() => goTo(safeIndex + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          {activeSlide ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="cursor-pointer"
            >
              <Link href={`/charts/${activeSlide.id}`}>Customize</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {slides.map((slide, index) => {
          if (!visited.has(slide.id) && index !== safeIndex) {
            return null;
          }
          return (
            <div
              key={slide.id}
              className={cn(
                'absolute inset-0 flex min-h-0 flex-col',
                index === safeIndex
                  ? 'z-10'
                  : 'pointer-events-none invisible z-0'
              )}
              aria-hidden={index !== safeIndex}
            >
              <DashboardSlideBoard
                slide={slide}
                accessibleProjects={accessibleProjects}
                accessibleSprints={accessibleSprints}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
