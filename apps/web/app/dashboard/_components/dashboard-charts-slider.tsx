'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LayoutItem } from 'react-grid-layout';
import { Button } from '@repo/ui/components/ui/button';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from '@repo/ui/lib/icons';
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
  /** When true, omit the Customize control (parent owns Overview customize). */
  readonly hideCustomizeButton?: boolean;
  // eslint-disable-next-line no-unused-vars -- active slide callback
  readonly onActiveSlideChange?: (slideId: string | null) => void;
};

function DashboardChartsSliderEmpty() {
  return (
    <div className="border-border bg-card mx-auto flex min-h-72 w-full max-w-md flex-1 flex-col justify-between gap-6 rounded-xl border p-6 shadow-none">
      <div className="space-y-3">
        <div className="space-y-1">
          <p className="text-foreground text-base font-semibold tracking-tight">
            Charts on Overview
          </p>
          <p className="text-muted-foreground text-sm">
            Pin a workspace for the slider
          </p>
        </div>
        <BarChart3
          className="text-muted-foreground size-8 stroke-[1.5]"
          aria-hidden
        />
        <p className="text-muted-foreground text-sm leading-relaxed">
          Pin chart workspaces from Charts → Edit → Show on dashboard to build
          the Overview slider.
        </p>
      </div>
      <Button asChild className="w-full cursor-pointer">
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
  hideCustomizeButton = false,
  onActiveSlideChange,
}: Readonly<DashboardChartsSliderProps>) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [visited, setVisited] = useState<ReadonlySet<string>>(
    () => new Set(slides[0] ? [slides[0].id] : [])
  );

  const safeIndex = Math.min(activeIndex, Math.max(slides.length - 1, 0));
  const activeSlide = slides[safeIndex] ?? null;

  useEffect(() => {
    onActiveSlideChange?.(activeSlide?.id ?? null);
  }, [activeSlide?.id, onActiveSlideChange]);

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

  const showSlider = slides.length > 1;
  const customizeHref = activeSlide
    ? `/charts/${activeSlide.id}`
    : null;
  const showCustomize = !hideCustomizeButton && Boolean(customizeHref);
  const showToolbar = showSlider || showCustomize;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4">
      {showToolbar ? (
        <div
          className={cn(
            'flex w-full shrink-0 items-center gap-2',
            showSlider ? undefined : 'justify-end'
          )}
        >
          {showSlider ? (
            <div className="flex min-w-0 flex-1 justify-center">
              <div className="flex max-w-full min-w-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 cursor-pointer"
                  disabled={safeIndex <= 0}
                  aria-label="Previous workspace"
                  onClick={() => goTo(safeIndex - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="flex min-w-0 flex-wrap items-center justify-center gap-2">
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 cursor-pointer"
                  disabled={safeIndex >= slides.length - 1}
                  aria-label="Next workspace"
                  onClick={() => goTo(safeIndex + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : null}
          {showCustomize && customizeHref ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  asChild
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 cursor-pointer"
                >
                  <Link href={customizeHref} aria-label="Customize">
                    <SlidersHorizontal className="size-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Customize</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      ) : null}

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
