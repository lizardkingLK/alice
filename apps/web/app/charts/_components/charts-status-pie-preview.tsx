'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Cell,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
  type ChartConfig,
} from '@repo/ui/components/ui/chart';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import {
  buildChartsStatusPieFromSample,
  type ChartsSampleWorkItem,
} from '@/app/charts/_components/charts-sample.data';

type ChartSize = {
  width: number;
  height: number;
};

type ChartsStatusPiePreviewProps = {
  readonly className?: string;
  readonly size?: 'card' | 'dialog';
  readonly workItems?: readonly ChartsSampleWorkItem[];
};

export function ChartsStatusPiePreview({
  className,
  size = 'card',
  workItems,
}: Readonly<ChartsStatusPiePreviewProps>) {
  const isDialog = size === 'dialog';
  const { data, config, total } = useMemo(
    () => buildChartsStatusPieFromSample(workItems),
    [workItems]
  );

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 items-center justify-center',
        isDialog ? 'gap-8 px-4 py-2' : 'gap-3 px-1 py-1',
        className
      )}
    >
      <PieViewport
        className={cn(
          'relative min-h-0 min-w-0 flex-1',
          // Cap pie so it stays medium — scales with the widget, not huge.
          isDialog
            ? 'mx-auto aspect-square h-full max-h-[min(100%,22rem)] max-w-[min(100%,22rem)]'
            : 'mx-auto aspect-square h-full max-h-full max-w-[min(100%,14rem)]'
        )}
        config={config}
      >
        <PieChart>
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel nameKey="status" />}
          />
          <Pie
            data={[...data]}
            dataKey="count"
            nameKey="status"
            innerRadius={0}
            outerRadius="90%"
            strokeWidth={0}
            paddingAngle={1}
          >
            {data.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </PieViewport>

      <ul
        className={cn(
          'flex shrink-0 flex-col justify-center',
          isDialog ? 'min-w-36 gap-3' : 'min-w-28 gap-1.5'
        )}
        aria-label="Status legend"
      >
        {data.length === 0 ? (
          <li className="text-muted-foreground text-sm">No sample tasks</li>
        ) : (
          data.map((entry) => (
            <li
              key={entry.status}
              className="flex min-w-0 items-center gap-2 text-sm"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.swatch }}
                aria-hidden
              />
              <TruncatedText
                className={cn(
                  'text-foreground min-w-0',
                  isDialog ? 'max-w-44' : 'max-w-32'
                )}
              >
                {`${entry.label}: ${entry.percent}`}
              </TruncatedText>
            </li>
          ))
        )}
        {total > 0 ? (
          <li className="text-muted-foreground pt-1 text-xs">
            {total} sample tasks
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function PieViewport({
  config,
  children,
  className,
}: Readonly<{
  config: ChartConfig;
  children: ReactNode;
  className?: string;
}>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }

    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      const side = Math.floor(Math.min(width, height));
      if (side <= 0) {
        return;
      }
      setSize((previous) => {
        if (previous?.width === side && previous.height === side) {
          return previous;
        }
        return { width: side, height: side };
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={viewportRef} className={cn('relative', className)}>
      {size ? (
        <ChartContainer
          config={config}
          width={size.width}
          height={size.height}
          className="absolute inset-0 m-auto aspect-auto h-full w-full justify-center"
        >
          {children}
        </ChartContainer>
      ) : null}
    </div>
  );
}
