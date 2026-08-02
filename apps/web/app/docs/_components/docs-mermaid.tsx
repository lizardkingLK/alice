'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import { TransformComponent, TransformWrapper } from 'react-zoom-pan-pinch';
import { Button } from '@repo/ui/components/ui/button';
import { Maximize2, Minimize2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type DocsMermaidProps = {
  readonly chart: string;
  readonly className?: string;
};

type MermaidApi = typeof import('mermaid').default;

const MIN_SCALE = 0.1;
const MAX_SCALE = 16;

let mermaidInit: Promise<MermaidApi> | null = null;

function getMermaid(): Promise<MermaidApi> {
  mermaidInit ??= import('mermaid').then((mod) => {
    mod.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'neutral',
      fontFamily: 'inherit',
    });
    return mod.default;
  });
  return mermaidInit;
}

function normalizeMermaidSource(chart: string): string {
  let start = 0;
  let end = chart.length;
  while (start < end && chart[start] === '\n') {
    start += 1;
  }
  while (end > start && chart[end - 1] === '\n') {
    end -= 1;
  }
  return chart.slice(start, end);
}

type MermaidViewportProps = {
  readonly svg: string;
  readonly isMaximized: boolean;
  readonly onToggleMaximize: () => void;
  readonly className?: string;
};

function MermaidViewport({
  svg,
  isMaximized,
  onToggleMaximize,
  className,
}: MermaidViewportProps) {
  useEffect(() => {
    if (!isMaximized) {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onToggleMaximize();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMaximized, onToggleMaximize]);

  const canvas = (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border',
        isMaximized
          ? 'border-border bg-background min-h-0 flex-1'
          : 'border-border bg-muted/20 h-96',
        className
      )}
    >
      {!isMaximized ? (
        <div className="absolute top-2 right-2 z-10">
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="bg-background/90 cursor-pointer shadow-sm"
            onClick={onToggleMaximize}
            title="Fullscreen"
            aria-label="Fullscreen diagram"
          >
            <Maximize2 className="size-4" />
          </Button>
        </div>
      ) : null}

      <TransformWrapper
        key={isMaximized ? 'maximized' : 'inline'}
        initialScale={1}
        minScale={MIN_SCALE}
        maxScale={MAX_SCALE}
        smooth
        wheel={{ step: 0.008 }}
        pinch={{ step: 4 }}
        doubleClick={{ mode: 'zoomIn', step: 0.45, animationTime: 200 }}
        zoomAnimation={{ disabled: true, size: 0 }}
        limitToBounds={false}
        centerOnInit
      >
        <TransformComponent
          wrapperClass="h-full w-full cursor-grab"
          contentClass="flex h-full w-full items-center justify-center [&_svg]:h-auto [&_svg]:max-w-none"
          wrapperStyle={{ width: '100%', height: '100%' }}
        >
          <figure className="m-0">
            <div
              // Mermaid returns SVG from local markdown via securityLevel: strict.
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <figcaption className="sr-only">
              Mermaid diagram. Scroll to zoom, drag to pan.
            </figcaption>
          </figure>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );

  if (!isMaximized) {
    return <div className="my-6">{canvas}</div>;
  }

  return (
    <div className="bg-background fixed inset-0 z-50 flex flex-col gap-3 p-4 sm:p-6">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          Scroll to zoom · drag to pan · Esc to exit
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="cursor-pointer"
          onClick={onToggleMaximize}
        >
          <Minimize2 className="size-4" data-icon="inline-start" />
          Exit fullscreen
        </Button>
      </div>
      {canvas}
    </div>
  );
}

export function DocsMermaid({ chart, className }: DocsMermaidProps) {
  const reactId = useId().replaceAll(':', '');
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const toggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const source = normalizeMermaidSource(chart);

    async function renderDiagram() {
      try {
        const mermaid = await getMermaid();
        const renderId = `docs-mermaid-${reactId}`;
        const { svg: rendered } = await mermaid.render(renderId, source);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch (cause) {
        if (!cancelled) {
          setSvg(null);
          setError(
            cause instanceof Error ? cause.message : 'Failed to render diagram.'
          );
        }
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [chart, reactId]);

  if (error) {
    return (
      <div
        className={cn(
          'border-destructive/40 bg-destructive/5 text-destructive my-6 overflow-x-auto rounded-lg border p-4 text-sm',
          className
        )}
        role="alert"
      >
        <p className="font-medium">Mermaid diagram failed to render</p>
        <pre className="mt-2 font-mono text-xs whitespace-pre-wrap">
          {error}
        </pre>
        <pre className="text-muted-foreground mt-3 font-mono text-xs whitespace-pre-wrap">
          {normalizeMermaidSource(chart)}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        className={cn(
          'border-border bg-muted/40 text-muted-foreground my-6 rounded-lg border px-4 py-8 text-center text-sm',
          className
        )}
        aria-busy="true"
      >
        Rendering diagram…
      </div>
    );
  }

  return (
    <MermaidViewport
      svg={svg}
      isMaximized={isMaximized}
      onToggleMaximize={toggleMaximize}
      className={className}
    />
  );
}
