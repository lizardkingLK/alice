'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  BookOpen,
  ExternalLink,
  FolderKanban,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
} from '@repo/ui/lib/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { ChatClient } from '@/app/chat/_components/chat-client';
import { useChatBootstrap } from '@/app/chat/_helpers/use-chat-bootstrap';
import { DashboardWidgetShell } from '@/app/dashboard/_components/dashboard-widget-shell';
import { PRODUCTIVITY_WIDGET_CATALOG } from '@/app/dashboard/_components/productivity/productivity-catalog';
import {
  clampPomodoroMinutes,
  POMODORO_DEFAULT_MINUTES,
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
  POMODORO_STEP_MINUTES,
  readPomodoroPreference,
  writePomodoroPreference,
} from '@/app/dashboard/_helpers/pomodoro-preference';
import type { ProductivityWidgetId } from '@/app/dashboard/_helpers/productivity-dashboard-preferences';
import type { ProductivityDashboardBootstrap } from '@/app/dashboard/_types/productivity-dashboard.types';
import { loadDocMarkdown } from '@/app/docs/_actions/docs-content.server';
import { DocsArticle } from '@/app/docs/_components/docs-article';
import {
  docHref,
  filterDocsIndex,
  type DocsIndexEntry,
} from '@/lib/docs/docs-shared';

const widgetById = Object.fromEntries(
  PRODUCTIVITY_WIDGET_CATALOG.map((widget) => [widget.id, widget])
) as Record<ProductivityWidgetId, (typeof PRODUCTIVITY_WIDGET_CATALOG)[number]>;

type KpiId =
  'my-work-assigned' | 'my-work-pending-stories' | 'my-work-in-progress';

function KpiWidget({
  id,
  value,
}: Readonly<{
  id: KpiId;
  value: number;
}>) {
  const meta = widgetById[id];
  return (
    <DashboardWidgetShell
      title={meta.title}
      description={meta.description}
      contentClassName="justify-end"
    >
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-1">
        <p className="text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl">
          {value}
        </p>
        <Button
          asChild
          variant="link"
          className="h-auto shrink-0 justify-start p-0 text-sm"
        >
          <Link href="/member">Open My Work</Link>
        </Button>
      </div>
    </DashboardWidgetShell>
  );
}

function ProjectsWidget({
  projects,
}: Readonly<{
  projects: ProductivityDashboardBootstrap['projects'];
}>) {
  const meta = widgetById.projects;
  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      {projects.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          You are not on any projects yet.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="hover:bg-muted/60 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
              >
                <FolderKanban
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                />
                <TruncatedText className="min-w-0 font-medium">
                  {project.name}
                </TruncatedText>
                {project.key ? (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {project.key}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link href="/projects">Browse projects</Link>
      </Button>
    </DashboardWidgetShell>
  );
}

function AliceWidget() {
  const meta = widgetById.alice;
  const { isLoading, conversations, chatModels } = useChatBootstrap({
    enabled: true,
    preferNewChat: true,
    logLabel: 'bootstrap Overview Alice widget',
  });

  const ready = conversations !== null && chatModels !== null && !isLoading;

  return (
    <DashboardWidgetShell
      title={meta.title}
      description={meta.description}
      contentClassName="px-0 pb-0"
      headerActions={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
            >
              <Link href="/chat" aria-label="Open full chat">
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Full chat</TooltipContent>
        </Tooltip>
      }
    >
      {ready ? (
        <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden border-t">
          <ChatClient
            variant="widget"
            initialConversations={conversations}
            initialConversationId={undefined}
            initialMessages={[]}
            initialChatModels={chatModels}
          />
        </div>
      ) : (
        <div className="text-muted-foreground flex min-h-40 flex-1 items-center justify-center gap-2 px-4 text-sm">
          <Sparkles className="size-4" aria-hidden />
          {isLoading ? 'Loading Alice…' : 'Alice is unavailable right now.'}
        </div>
      )}
    </DashboardWidgetShell>
  );
}

function DocsWidgetResults({
  docs,
  results,
  onOpenArticle,
}: Readonly<{
  docs: readonly DocsIndexEntry[];
  results: readonly DocsIndexEntry[];
  // eslint-disable-next-line no-unused-vars -- result click callback
  onOpenArticle: (entry: DocsIndexEntry) => void;
}>) {
  if (docs.length === 0) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        Docs will appear here once published.
      </p>
    );
  }
  if (results.length === 0) {
    return (
      <p className="text-muted-foreground text-center text-sm">
        No matching docs.
      </p>
    );
  }
  return (
    <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
      {results.map((entry) => (
        <li key={entry.slug}>
          <button
            type="button"
            className="hover:bg-muted/60 flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            onClick={() => onOpenArticle(entry)}
          >
            <BookOpen
              className="text-muted-foreground mt-0.5 size-4 shrink-0"
              aria-hidden
            />
            <span className="min-w-0">
              <TruncatedText className="font-medium">
                {entry.title}
              </TruncatedText>
              <span className="text-muted-foreground line-clamp-1 text-xs">
                {entry.section}
                {entry.excerpt ? ` · ${entry.excerpt}` : ''}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DocsWidget({
  docs,
}: Readonly<{
  docs: readonly DocsIndexEntry[];
}>) {
  const meta = widgetById.docs;
  const [query, setQuery] = useState('');
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [articleOpen, setArticleOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [activeEntry, setActiveEntry] = useState<DocsIndexEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const results = useMemo(
    () => filterDocsIndex(docs, query).slice(0, 12),
    [docs, query]
  );

  const openArticle = (entry: DocsIndexEntry) => {
    setActiveSlug(entry.slug);
    setActiveEntry(entry);
    setArticleOpen(true);
    setFullscreen(false);
    setMarkdown(null);
    setLoadError(null);
    setLoading(true);
    loadDocMarkdown(entry.slug)
      .then((payload) => {
        if (!payload) {
          setLoadError('Could not load this page.');
          return;
        }
        setActiveEntry(payload.entry);
        setMarkdown(payload.markdown);
      })
      .catch(() => {
        setLoadError('Could not load this page.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (articleOpen) {
      return;
    }
    setFullscreen(false);
  }, [articleOpen]);

  return (
    <>
      <DashboardWidgetShell title={meta.title} description={meta.description}>
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="relative mx-auto w-full max-w-sm">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search docs…"
              aria-label="Search documentation"
              className="h-8 pl-8"
            />
          </div>

          <DocsWidgetResults
            docs={docs}
            results={results}
            onOpenArticle={openArticle}
          />

          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-auto w-full"
          >
            <Link href="/docs">Open docs</Link>
          </Button>
        </div>
      </DashboardWidgetShell>

      <Dialog open={articleOpen} onOpenChange={setArticleOpen}>
        <DialogContent
          dismissOnOutsideClick={!fullscreen}
          className={cn(
            'flex flex-col gap-0 overflow-hidden p-0',
            fullscreen
              ? 'h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none sm:max-w-none'
              : 'max-h-[min(90vh,40rem)] sm:max-w-3xl'
          )}
        >
          <DialogHeader className="border-border flex shrink-0 flex-row items-center justify-between gap-3 space-y-0 border-b px-6 py-4 text-left">
            <DialogTitle className="flex min-w-0 items-center gap-2">
              <BookOpen className="size-4 shrink-0" aria-hidden />
              <TruncatedText className="min-w-0">
                {activeEntry?.title ?? 'Docs'}
              </TruncatedText>
            </DialogTitle>
            <div className="mr-8 flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                onClick={() => setFullscreen((previous) => !previous)}
              >
                {fullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </Button>
              {activeSlug ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={docHref(activeSlug)}>Open page</Link>
                </Button>
              ) : null}
            </div>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {loading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : null}
            {loadError ? (
              <p className="text-destructive text-sm" role="alert">
                {loadError}
              </p>
            ) : null}
            {!loading && !loadError && activeEntry && markdown ? (
              <DocsArticle
                title={activeEntry.title}
                section={activeEntry.section}
                slug={activeEntry.slug}
                path={activeEntry.path}
                markdown={markdown}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function formatTimer(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function PomodoroWidget({
  userId,
}: Readonly<{
  userId: string;
}>) {
  const meta = widgetById.pomodoro;
  const [durationMinutes, setDurationMinutes] = useState(
    POMODORO_DEFAULT_MINUTES
  );
  const [remaining, setRemaining] = useState(POMODORO_DEFAULT_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const preference = readPomodoroPreference(userId);
    setDurationMinutes(preference.durationMinutes);
    setRemaining(preference.durationMinutes * 60);
    setHydrated(true);
  }, [userId]);

  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!running) {
      clearTick();
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((previous) => {
        if (previous <= 1) {
          clearTick();
          setRunning(false);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
    return clearTick;
  }, [running, clearTick]);

  const applyDuration = (nextMinutes: number) => {
    const clamped = clampPomodoroMinutes(nextMinutes);
    setDurationMinutes(clamped);
    setRemaining(clamped * 60);
    setRunning(false);
    if (hydrated) {
      writePomodoroPreference(userId, { durationMinutes: clamped });
    }
  };

  const durationSeconds = durationMinutes * 60;
  const progress = durationSeconds === 0 ? 0 : 1 - remaining / durationSeconds;

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div
          className="relative flex size-28 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(var(--primary) ${progress * 360}deg, var(--muted) 0deg)`,
          }}
          aria-hidden
        >
          <div className="bg-card flex size-[6.5rem] items-center justify-center rounded-full">
            <p
              className={cn(
                'text-2xl font-semibold tracking-tight tabular-nums',
                remaining === 0 && 'text-muted-foreground'
              )}
            >
              {formatTimer(remaining)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Decrease duration"
            disabled={running || durationMinutes <= POMODORO_MIN_MINUTES}
            onClick={() =>
              applyDuration(durationMinutes - POMODORO_STEP_MINUTES)
            }
          >
            <Minus className="size-4" />
          </Button>
          <span className="text-muted-foreground min-w-16 text-center text-xs tabular-nums">
            {durationMinutes} min
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Increase duration"
            disabled={running || durationMinutes >= POMODORO_MAX_MINUTES}
            onClick={() =>
              applyDuration(durationMinutes + POMODORO_STEP_MINUTES)
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              if (remaining === 0) {
                setRemaining(durationMinutes * 60);
              }
              setRunning((previous) => !previous);
            }}
          >
            {running ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => {
              setRunning(false);
              setRemaining(durationMinutes * 60);
            }}
          >
            <RotateCcw className="size-4" />
            Reset
          </Button>
        </div>
      </div>
    </DashboardWidgetShell>
  );
}

export type ProductivityWidgetProps = {
  readonly id: ProductivityWidgetId;
  readonly userId: string;
  readonly bootstrap: ProductivityDashboardBootstrap;
};

export function ProductivityWidget({
  id,
  userId,
  bootstrap,
}: Readonly<ProductivityWidgetProps>) {
  switch (id) {
    case 'my-work-assigned':
      return <KpiWidget id={id} value={bootstrap.myWork.assignedOpen} />;
    case 'my-work-pending-stories':
      return <KpiWidget id={id} value={bootstrap.myWork.pendingStories} />;
    case 'my-work-in-progress':
      return <KpiWidget id={id} value={bootstrap.myWork.inProgress} />;
    case 'projects':
      return <ProjectsWidget projects={bootstrap.projects} />;
    case 'alice':
      return <AliceWidget />;
    case 'docs':
      return <DocsWidget docs={bootstrap.docs} />;
    case 'pomodoro':
      return <PomodoroWidget userId={userId} />;
    default:
      return null;
  }
}
