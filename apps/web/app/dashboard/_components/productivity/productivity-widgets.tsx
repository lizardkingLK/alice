'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type MutableRefObject,
  type ReactNode,
  type SetStateAction,
} from 'react';
import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FolderKanban,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from '@repo/ui/lib/icons';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { toast } from '@repo/ui/components/ui/sonner';
import { cn } from '@repo/ui/lib/utils';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';
import { ChatAgentChevronSwitcher } from '@/app/chat/_components/chat-agent-chevron-switcher';
import { ChatClient } from '@/app/chat/_components/chat-client';
import {
  shiftPreferredChatAssistant,
  type PreferredChatAssistantBootstrap,
} from '@/app/chat/_helpers/chat-assistant-identity';
import { rememberPreferredChatAgent } from '@/app/chat/_helpers/preferred-chat-agent-storage';
import { DashboardWidgetShell } from '@/app/dashboard/_components/dashboard-widget-shell';
import { PRODUCTIVITY_WIDGET_CATALOG } from '@/app/dashboard/_components/productivity/productivity-catalog';
import { projectDetailHref } from '@/app/projects/_helpers/project-links';
import {
  addFocusTodo,
  filterFocusTodos,
  focusFilterEmptyMessage,
  FOCUS_TODOS_CHANGED_EVENT,
  FOCUS_TODOS_MAX,
  readFocusTodos,
  removeFocusTodo,
  reorderFocusTodos,
  toggleFocusTodo,
  writeFocusTodos,
  type FocusTodo,
  type FocusTodoDropEdge,
  type FocusTodoFilter,
} from '@/app/dashboard/_helpers/focus-todos';
import {
  PERSONAL_CALENDAR_CHANGED_EVENT,
  readPersonalCalendarEvents,
  reconcileTodayFocusAndCalendar,
  removeCalendarEventsForFocusTodos,
  shouldWriteFocusTodos,
  shouldWritePersonalCalendarEvents,
  writePersonalCalendarEvents,
} from '@/app/dashboard/_helpers/personal-calendar';
import {
  readFocusWidgetPane,
  shiftFocusWidgetPane,
  writeFocusWidgetPane,
  type FocusWidgetPane,
} from '@/app/dashboard/_helpers/focus-widget-pane';
import {
  MY_WORK_CATEGORIES_PANE_META,
  readMyWorkCategoriesPane,
  shiftMyWorkCategoriesPane,
  writeMyWorkCategoriesPane,
  type MyWorkCategoriesPane,
} from '@/app/dashboard/_helpers/my-work-categories-pane';
import { MusicWidget } from '@/app/dashboard/_components/productivity/music-widget';
import { PersonalCalendarWidget } from '@/app/dashboard/_components/productivity/personal-calendar-widget';
import {
  ensurePomodoroNotifyPermission,
  notifyPomodoroComplete,
  POMODORO_COMPLETE_BODY,
  POMODORO_COMPLETE_TITLE,
} from '@/app/dashboard/_helpers/pomodoro-browser-notify';
import {
  clampPomodoroMinutes,
  formatFocusDurationLabel,
  formatFocusTimer,
  hydratePomodoroState,
  pomodoroPrimaryActionLabel,
  POMODORO_DEFAULT_MINUTES,
  POMODORO_MAX_MINUTES,
  POMODORO_MIN_MINUTES,
  POMODORO_PERSIST_INTERVAL_MS,
  POMODORO_STEP_MINUTES,
  readPomodoroStoredState,
  writePomodoroStoredState,
  type PomodoroPhase,
} from '@/app/dashboard/_helpers/pomodoro-preference';
import type { ProductivityWidgetId } from '@/app/dashboard/_helpers/productivity-dashboard-preferences';
import type { ProductivityDashboardBootstrap } from '@/app/dashboard/_types/productivity-dashboard.types';
import { HomeNotificationList } from '@/app/_components/home/home-notifications-panel';
import {
  AssignedCompletionPill,
  HomeWipList,
} from '@/app/_components/home/home-wip-panel';
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

function myWorkCategoriesValue(
  pane: MyWorkCategoriesPane,
  stats: ProductivityDashboardBootstrap['myWork']
): number {
  if (pane === 'in-progress') {
    return stats.inProgress;
  }
  if (pane === 'pending-stories') {
    return stats.pendingStories;
  }
  return stats.assignedOpen;
}

function MyWorkCategoriesWidget({
  userId,
  stats,
}: Readonly<{
  userId: string;
  stats: ProductivityDashboardBootstrap['myWork'];
}>) {
  const [pane, setPane] = useState<MyWorkCategoriesPane>(() =>
    readMyWorkCategoriesPane(userId)
  );

  useEffect(() => {
    setPane(readMyWorkCategoriesPane(userId));
  }, [userId]);

  const persistPane = (next: MyWorkCategoriesPane) => {
    setPane(next);
    writeMyWorkCategoriesPane(userId, next);
  };

  const shiftPane = (direction: -1 | 1) => {
    persistPane(shiftMyWorkCategoriesPane(pane, direction));
  };

  const paneMeta = MY_WORK_CATEGORIES_PANE_META[pane];
  const value = myWorkCategoriesValue(pane, stats);

  return (
    <DashboardWidgetShell
      variant="glass"
      title={paneMeta.title}
      description={paneMeta.description}
      contentClassName="justify-end"
      headerActions={
        <div className="flex items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="Previous category"
                onClick={() => shiftPane(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Previous category</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="Next category"
                onClick={() => shiftPane(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Next category</TooltipContent>
          </Tooltip>
        </div>
      }
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
    <DashboardWidgetShell
      variant="glass"
      title={meta.title}
      description={meta.description}
    >
      {projects.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          You are not on any projects yet.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={projectDetailHref(project.key ?? project.id)}
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

function AliceWidget({
  userId,
  chatModels,
  chatAgents,
  preferredChatAgentId,
}: Readonly<{
  userId: string;
  chatModels: ProductivityDashboardBootstrap['chatModels'];
  chatAgents: ProductivityDashboardBootstrap['chatAgents'];
  preferredChatAgentId: ProductivityDashboardBootstrap['preferredChatAgentId'];
}>) {
  const meta = widgetById.alice;
  const hasModels = chatModels.length > 0;
  const agents = hasModels ? chatAgents : [];
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(
    () => preferredChatAgentId
  );

  useEffect(() => {
    setSelectedAgentId(preferredChatAgentId);
  }, [preferredChatAgentId]);

  const selectedAgent: PreferredChatAssistantBootstrap | null =
    agents.find((agent) => agent.agentId === selectedAgentId) ??
    agents[0] ??
    null;
  const identity = selectedAgent?.identity ?? null;
  const showAgentChevrons = hasModels && agents.length > 0;

  const shiftAgent = (direction: -1 | 1) => {
    const next = shiftPreferredChatAssistant(
      agents,
      selectedAgent?.agentId,
      direction
    );
    if (!next) {
      return;
    }
    setSelectedAgentId(next.agentId);
    rememberPreferredChatAgent(next.agentId);
  };

  return (
    <DashboardWidgetShell
      variant="glass"
      title={identity?.name ?? meta.title}
      description={identity?.title ?? meta.description}
      contentClassName="px-0 pb-0"
      titleStart={
        identity ? (
          <ChatAgentAvatar
            name={identity.name}
            kind={identity.kind}
            avatarStyle={identity.avatarStyle}
            avatarSeed={identity.avatarSeed}
            size="sm"
          />
        ) : null
      }
      headerActions={
        <div className="flex items-center">
          {showAgentChevrons ? (
            <ChatAgentChevronSwitcher
              disabled={agents.length < 2}
              onShift={shiftAgent}
            />
          ) : null}
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
        </div>
      }
    >
      <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden border-t">
        <ChatClient
          key={selectedAgent?.agentId ?? 'alice-widget'}
          variant="widget"
          currentUserId={userId}
          initialConversations={[]}
          initialConversationId={undefined}
          initialMessages={[]}
          initialChatModels={[...chatModels]}
          initialAgentId={selectedAgent?.agentId}
          initialAssistantIdentity={identity}
          initialChatAgents={agents}
        />
      </div>
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
      <DashboardWidgetShell
        variant="glass"
        title={meta.title}
        description={meta.description}
      >
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
              ? 'h-dvh max-h-dvh w-screen max-w-none rounded-none sm:max-w-none'
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

const FOCUS_TODO_FILTERS: readonly {
  readonly id: FocusTodoFilter;
  readonly label: string;
}[] = [
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

/** Once per session — keeps toast/notify out of the tick callback nest. */
function announcePomodoroCompleteOnce(
  announcedRef: MutableRefObject<boolean>
): void {
  if (announcedRef.current) {
    return;
  }
  announcedRef.current = true;
  queueMicrotask(() => {
    notifyPomodoroComplete();
    toast.message(POMODORO_COMPLETE_TITLE, {
      description: POMODORO_COMPLETE_BODY,
    });
  });
}

type PersistPomodoroSessionArgs = {
  readonly phase: PomodoroPhase;
  readonly remainingSeconds: number;
  readonly durationMinutes?: number;
};

type PersistPomodoroSession = (
  // eslint-disable-next-line no-unused-vars -- persist callback
  next: PersistPomodoroSessionArgs
) => void;

function applyPomodoroTick(
  previous: number,
  clearTick: () => void,
  setPhase: Dispatch<SetStateAction<PomodoroPhase>>,
  persistSession: PersistPomodoroSession,
  announcedRef: MutableRefObject<boolean>
): number {
  if (previous > 1) {
    return previous - 1;
  }
  clearTick();
  setPhase('idle');
  persistSession({ phase: 'idle', remainingSeconds: 0 });
  announcePomodoroCompleteOnce(announcedRef);
  return 0;
}

type FocusTimerSectionProps = {
  readonly remaining: number;
  readonly durationMinutes: number;
  readonly phase: PomodoroPhase;
  readonly running: boolean;
  readonly sessionComplete: boolean;
  readonly progress: number;
  readonly remainingRef: MutableRefObject<number>;
  readonly finishAnnouncedRef: MutableRefObject<boolean>;
  readonly persistSession: PersistPomodoroSession;
  // eslint-disable-next-line no-unused-vars -- duration callback
  readonly onApplyDuration: (nextMinutes: number) => void;
  readonly onSetPhase: Dispatch<SetStateAction<PomodoroPhase>>;
  readonly onSetRemaining: Dispatch<SetStateAction<number>>;
};

function FocusTimerSection({
  remaining,
  durationMinutes,
  phase,
  running,
  sessionComplete,
  progress,
  remainingRef,
  finishAnnouncedRef,
  persistSession,
  onApplyDuration,
  onSetPhase,
  onSetRemaining,
}: Readonly<FocusTimerSectionProps>) {
  const ringBackground = sessionComplete
    ? `conic-gradient(
        from 0deg,
        color-mix(in oklch, var(--primary) 88%, white) 0deg,
        var(--primary) 120deg,
        color-mix(in oklch, var(--primary) 70%, var(--muted)) 240deg,
        color-mix(in oklch, var(--primary) 88%, white) 360deg
      )`
    : `conic-gradient(var(--primary) ${progress * 360}deg, var(--muted) 0deg)`;

  const pauseOrStart = () => {
    if (running) {
      onSetPhase('paused');
      persistSession({
        phase: 'paused',
        remainingSeconds: remainingRef.current,
      });
      return;
    }
    const nextRemaining = remaining === 0 ? durationMinutes * 60 : remaining;
    if (remaining === 0) {
      onSetRemaining(nextRemaining);
    }
    finishAnnouncedRef.current = false;
    onSetPhase('running');
    persistSession({
      phase: 'running',
      remainingSeconds: nextRemaining,
    });
    void ensurePomodoroNotifyPermission();
  };

  const resetTimer = () => {
    const nextRemaining = durationMinutes * 60;
    finishAnnouncedRef.current = false;
    onSetPhase('idle');
    onSetRemaining(nextRemaining);
    persistSession({
      phase: 'idle',
      remainingSeconds: nextRemaining,
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-center gap-3">
      {/* Extra box so the outward Done halo isn’t clipped by the ring. */}
      <div className="flex size-36 items-center justify-center">
        <div
          className={cn(
            'relative flex size-28 items-center justify-center rounded-full',
            sessionComplete && 'focus-timer-done'
          )}
          style={{ background: ringBackground }}
          aria-hidden
        >
          <div
            className={cn(
              'bg-card/80 flex size-26 flex-col items-center justify-center rounded-full backdrop-blur-md',
              sessionComplete &&
                'bg-card/70 shadow-[inset_0_1px_0_color-mix(in_oklch,white_45%,transparent)]'
            )}
          >
            {sessionComplete ? (
              <p className="text-primary text-xl font-semibold tracking-wide sm:text-2xl">
                Done
              </p>
            ) : (
              <p className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">
                {formatFocusTimer(remaining)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Decrease duration"
              disabled={
                running ||
                sessionComplete ||
                durationMinutes <= POMODORO_MIN_MINUTES
              }
              onClick={() =>
                onApplyDuration(durationMinutes - POMODORO_STEP_MINUTES)
              }
            >
              <Minus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Shorter</TooltipContent>
        </Tooltip>
        <span className="text-muted-foreground min-w-12 text-center text-xs tabular-nums">
          {formatFocusDurationLabel(durationMinutes)}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Increase duration"
              disabled={
                running ||
                sessionComplete ||
                durationMinutes >= POMODORO_MAX_MINUTES
              }
              onClick={() =>
                onApplyDuration(durationMinutes + POMODORO_STEP_MINUTES)
              }
            >
              <Plus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Longer</TooltipContent>
        </Tooltip>

        <span className="bg-border mx-1 h-4 w-px shrink-0" aria-hidden />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-sm"
              className="cursor-pointer"
              aria-label={pomodoroPrimaryActionLabel(phase)}
              onClick={pauseOrStart}
            >
              {running ? (
                <Pause className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {pomodoroPrimaryActionLabel(phase)}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Reset timer"
              onClick={resetTimer}
            >
              <RotateCcw className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Reset</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

type FocusTodosPanelProps = {
  readonly todos: readonly FocusTodo[];
  readonly visibleTodos: readonly FocusTodo[];
  readonly todoFilter: FocusTodoFilter;
  readonly draftTodo: string;
  readonly draggedTodoId: string | null;
  readonly dropIndicator: {
    readonly id: string;
    readonly edge: FocusTodoDropEdge;
  } | null;
  readonly onTodoFilterChange: Dispatch<SetStateAction<FocusTodoFilter>>;
  readonly onDraftChange: Dispatch<SetStateAction<string>>;
  readonly onSubmitTodo: () => void;
  // eslint-disable-next-line no-unused-vars -- toggle callback
  readonly onToggleTodo: (todoId: string) => void;
  // eslint-disable-next-line no-unused-vars -- delete callback
  readonly onDeleteTodo: (todoId: string) => void;
  readonly onDragStart: (
    // eslint-disable-next-line no-unused-vars -- drag callback
    event: DragEvent<HTMLElement>,
    // eslint-disable-next-line no-unused-vars -- drag callback
    id: string
  ) => void;
  readonly onDragOver: (
    // eslint-disable-next-line no-unused-vars -- drag callback
    event: DragEvent<HTMLLIElement>,
    // eslint-disable-next-line no-unused-vars -- drag callback
    id: string
  ) => void;
  readonly onDrop: (
    // eslint-disable-next-line no-unused-vars -- drop callback
    event: DragEvent<HTMLLIElement>,
    // eslint-disable-next-line no-unused-vars -- drop callback
    id: string
  ) => void;
  readonly onDragEnd: () => void;
  // eslint-disable-next-line no-unused-vars -- indicator callback
  readonly onClearDropIndicator: (todoId: string) => void;
};

function FocusTodosPanel({
  todos,
  visibleTodos,
  todoFilter,
  draftTodo,
  draggedTodoId,
  dropIndicator,
  onTodoFilterChange,
  onDraftChange,
  onSubmitTodo,
  onToggleTodo,
  onDeleteTodo,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onClearDropIndicator,
}: Readonly<FocusTodosPanelProps>) {
  const showEmpty = todos.length === 0 || visibleTodos.length === 0;
  const atCapacity = todos.length >= FOCUS_TODOS_MAX;

  let listBody = (
    <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
      {visibleTodos.map((todo) => {
        const showBefore =
          dropIndicator?.id === todo.id &&
          dropIndicator.edge === 'before' &&
          draggedTodoId !== todo.id;
        const showAfter =
          dropIndicator?.id === todo.id &&
          dropIndicator.edge === 'after' &&
          draggedTodoId !== todo.id;
        return (
          <li
            key={todo.id}
            className={cn(
              'hover:bg-muted/40 border-border/60 bg-background/40 relative flex items-center gap-2 rounded-lg border px-2 py-2.5',
              draggedTodoId === todo.id && 'opacity-50'
            )}
            onDragOver={(event) => onDragOver(event, todo.id)}
            onDrop={(event) => onDrop(event, todo.id)}
            onDragLeave={() => onClearDropIndicator(todo.id)}
          >
            {showBefore ? (
              <span className="bg-primary absolute inset-x-2 -top-0.5 h-0.5 rounded-full" />
            ) : null}
            <button
              type="button"
              draggable
              className="text-muted-foreground hover:text-foreground shrink-0 cursor-grab touch-none active:cursor-grabbing"
              aria-label={`Reorder "${todo.text}"`}
              onDragStart={(event) => onDragStart(event, todo.id)}
              onDragEnd={onDragEnd}
            >
              <GripVertical className="size-4" />
            </button>
            <Checkbox
              checked={todo.done}
              onCheckedChange={() => onToggleTodo(todo.id)}
              aria-label={
                todo.done
                  ? `Mark "${todo.text}" as not done`
                  : `Mark "${todo.text}" as done`
              }
            />
            <TruncatedText
              className={cn(
                'min-w-0 flex-1 text-sm',
                todo.done && 'text-muted-foreground line-through'
              )}
            >
              {todo.text}
            </TruncatedText>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground size-8 shrink-0 cursor-pointer"
              aria-label={`Delete "${todo.text}"`}
              onClick={() => onDeleteTodo(todo.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
            {showAfter ? (
              <span className="bg-primary absolute inset-x-2 -bottom-0.5 h-0.5 rounded-full" />
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  if (showEmpty) {
    listBody = (
      <div className="flex min-h-0 flex-1 items-center justify-center px-2">
        <p className="text-muted-foreground text-center text-xs">
          {focusFilterEmptyMessage(todos.length, todoFilter)}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 justify-end">
        <Tabs
          value={todoFilter}
          onValueChange={(value) =>
            onTodoFilterChange(value as FocusTodoFilter)
          }
          className="w-auto"
        >
          <TabsList
            aria-label="Task filter"
            className="border-border flex h-auto justify-end gap-3 rounded-none border-b bg-transparent p-0"
          >
            {FOCUS_TODO_FILTERS.map((filter) => (
              <TabsTrigger
                key={filter.id}
                value={filter.id}
                className={cn(UNDERLINE_TAB_TRIGGER_CLASS, 'px-0 text-xs')}
              >
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{listBody}</div>

      <form
        className="mt-auto flex shrink-0 gap-2 p-0.5 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitTodo();
        }}
      >
        <Input
          value={draftTodo}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add a focus task…"
          aria-label="New focus task"
          className="h-9"
          maxLength={200}
          disabled={atCapacity}
        />
        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0 cursor-pointer"
          disabled={!draftTodo.trim() || atCapacity}
        >
          Add
        </Button>
      </form>
    </div>
  );
}

function PomodoroWidget({
  userId,
}: Readonly<{
  userId: string;
}>) {
  const meta = widgetById.pomodoro;
  const [pane, setPane] = useState<FocusWidgetPane>(() =>
    readFocusWidgetPane(userId)
  );
  const [musicMaximized, setMusicMaximized] = useState(false);
  /** Keep the Music embed mounted after first visit so playback survives pane switches. */
  const [musicKeepAlive, setMusicKeepAlive] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(
    POMODORO_DEFAULT_MINUTES
  );
  const [remaining, setRemaining] = useState(POMODORO_DEFAULT_MINUTES * 60);
  const [phase, setPhase] = useState<PomodoroPhase>('idle');
  const [hydrated, setHydrated] = useState(false);
  const [todos, setTodos] = useState<FocusTodo[]>([]);
  const [draftTodo, setDraftTodo] = useState('');
  const [todoFilter, setTodoFilter] = useState<FocusTodoFilter>('active');
  const [draggedTodoId, setDraggedTodoId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    readonly id: string;
    readonly edge: FocusTodoDropEdge;
  } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Guards against double toast (Strict Mode / overlapping ticks). */
  const finishAnnouncedRef = useRef(false);
  const remainingRef = useRef(remaining);
  const durationRef = useRef(durationMinutes);
  remainingRef.current = remaining;
  durationRef.current = durationMinutes;
  const running = phase === 'running';
  const sessionComplete = remaining === 0;
  const visibleTodos = useMemo(
    () => filterFocusTodos(todos, todoFilter),
    [todos, todoFilter]
  );

  const persistTodos = useCallback(
    (next: FocusTodo[], removedIds: readonly string[] = []) => {
      let events = readPersonalCalendarEvents(userId);
      if (removedIds.length > 0) {
        events = removeCalendarEventsForFocusTodos(events, removedIds);
      }
      const reconciled = reconcileTodayFocusAndCalendar(next, events);
      setTodos(reconciled.todos);
      // Calendar first so date-cell counts refresh before Focus storage events.
      if (shouldWritePersonalCalendarEvents(events, reconciled.events)) {
        writePersonalCalendarEvents(userId, reconciled.events);
      }
      writeFocusTodos(userId, reconciled.todos);
    },
    [userId]
  );

  const persistSession = useCallback<PersistPomodoroSession>(
    (next) => {
      writePomodoroStoredState(userId, {
        durationMinutes: next.durationMinutes ?? durationRef.current,
        phase: next.phase,
        remainingSeconds: next.remainingSeconds,
        savedAtMs: Date.now(),
      });
    },
    [userId]
  );

  const reconcileWithCalendar = useCallback(() => {
    const calendarEvents = readPersonalCalendarEvents(userId);
    const existing = readFocusTodos(userId);
    const reconciled = reconcileTodayFocusAndCalendar(existing, calendarEvents);
    setTodos(reconciled.todos);
    if (shouldWriteFocusTodos(existing, reconciled.todos)) {
      writeFocusTodos(userId, reconciled.todos);
    }
    if (shouldWritePersonalCalendarEvents(calendarEvents, reconciled.events)) {
      writePersonalCalendarEvents(userId, reconciled.events);
    }
  }, [userId]);

  useEffect(() => {
    setPane(readFocusWidgetPane(userId));
    setMusicKeepAlive(false);
  }, [userId]);

  useEffect(() => {
    if (pane === 'music') {
      setMusicKeepAlive(true);
    }
  }, [pane]);

  useEffect(() => {
    const stored = readPomodoroStoredState(userId);
    const hydratedState = hydratePomodoroState(stored);
    setDurationMinutes(hydratedState.durationMinutes);
    setRemaining(hydratedState.remainingSeconds);
    setPhase(hydratedState.phase);
    reconcileWithCalendar();
    setHydrated(true);
    // Re-stamp so the next catch-up window starts from open time.
    writePomodoroStoredState(userId, {
      durationMinutes: hydratedState.durationMinutes,
      phase: hydratedState.phase,
      remainingSeconds: hydratedState.remainingSeconds,
      savedAtMs: Date.now(),
    });
  }, [reconcileWithCalendar, userId]);

  const persistPane = (next: FocusWidgetPane) => {
    setPane(next);
    setMusicMaximized(false);
    writeFocusWidgetPane(userId, next);
  };

  const shiftPane = (direction: -1 | 1) => {
    persistPane(shiftFocusWidgetPane(pane, direction));
  };

  let paneTitle = meta.title;
  let paneDescription = meta.description;
  if (pane === 'calendar') {
    paneTitle = 'Calendar';
    paneDescription = 'Personal schedule on this device';
  } else if (pane === 'music') {
    paneTitle = 'Music';
    // Playlist identity lives in the embed — skip redundant subtitle.
    paneDescription = '';
  }

  useEffect(() => {
    const onCalendarChanged = () => {
      reconcileWithCalendar();
    };
    const onFocusTodosChanged = () => {
      setTodos(readFocusTodos(userId));
    };
    window.addEventListener(PERSONAL_CALENDAR_CHANGED_EVENT, onCalendarChanged);
    window.addEventListener(FOCUS_TODOS_CHANGED_EVENT, onFocusTodosChanged);
    return () => {
      window.removeEventListener(
        PERSONAL_CALENDAR_CHANGED_EVENT,
        onCalendarChanged
      );
      window.removeEventListener(
        FOCUS_TODOS_CHANGED_EVENT,
        onFocusTodosChanged
      );
    };
  }, [reconcileWithCalendar, userId]);

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
      setRemaining((previous) =>
        applyPomodoroTick(
          previous,
          clearTick,
          setPhase,
          persistSession,
          finishAnnouncedRef
        )
      );
    }, 1000);
    return clearTick;
  }, [running, clearTick, persistSession]);

  useEffect(() => {
    if (!hydrated || !running) {
      return;
    }
    const id = setInterval(() => {
      persistSession({
        phase: 'running',
        remainingSeconds: remainingRef.current,
      });
    }, POMODORO_PERSIST_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hydrated, running, persistSession]);

  const applyDuration = (nextMinutes: number) => {
    const clamped = clampPomodoroMinutes(nextMinutes);
    const nextRemaining = clamped * 60;
    setDurationMinutes(clamped);
    setRemaining(nextRemaining);
    setPhase('idle');
    if (hydrated) {
      persistSession({
        phase: 'idle',
        remainingSeconds: nextRemaining,
        durationMinutes: clamped,
      });
    }
  };

  const submitTodo = () => {
    const next = addFocusTodo(todos, draftTodo);
    if (next.length === todos.length) {
      return;
    }
    persistTodos(next);
    setDraftTodo('');
  };

  const clearDragState = () => {
    setDraggedTodoId(null);
    setDropIndicator(null);
  };

  const handleTodoDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    setDraggedTodoId(id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const handleTodoDragOver = (event: DragEvent<HTMLLIElement>, id: string) => {
    if (!draggedTodoId || draggedTodoId === id) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const rect = event.currentTarget.getBoundingClientRect();
    const edge: FocusTodoDropEdge =
      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropIndicator((previous) => {
      if (previous?.id === id && previous.edge === edge) {
        return previous;
      }
      return { id, edge };
    });
  };

  const resolveTodoDropEdge = (
    event: DragEvent<HTMLLIElement>,
    id: string
  ): FocusTodoDropEdge => {
    if (dropIndicator?.id === id) {
      return dropIndicator.edge;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  };

  const handleTodoDrop = (event: DragEvent<HTMLLIElement>, id: string) => {
    event.preventDefault();
    if (!draggedTodoId) {
      return;
    }
    persistTodos(
      reorderFocusTodos(
        todos,
        draggedTodoId,
        id,
        resolveTodoDropEdge(event, id)
      )
    );
    clearDragState();
  };

  const durationSeconds = durationMinutes * 60;
  const progress = durationSeconds === 0 ? 0 : 1 - remaining / durationSeconds;

  const paneSwitcher = (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Previous view"
            onClick={() => shiftPane(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Previous view</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Next view"
            onClick={() => shiftPane(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Next view</TooltipContent>
      </Tooltip>
    </div>
  );

  const musicVisible = pane === 'music';
  // Off-screen (not display:none) so embeds keep decoding audio while
  // the user is on Focus / Calendar.
  const musicShelfClassName = musicVisible
    ? 'relative flex min-h-0 flex-1 flex-col'
    : 'pointer-events-none fixed top-0 -left-[100vw] z-[-1] h-[520px] w-[380px] overflow-hidden opacity-0';

  let foregroundPane: ReactNode = null;
  if (pane === 'calendar') {
    foregroundPane = <PersonalCalendarWidget userId={userId} embedded />;
  } else if (pane === 'focus') {
    foregroundPane = (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <FocusTimerSection
          remaining={remaining}
          durationMinutes={durationMinutes}
          phase={phase}
          running={running}
          sessionComplete={sessionComplete}
          progress={progress}
          remainingRef={remainingRef}
          finishAnnouncedRef={finishAnnouncedRef}
          persistSession={persistSession}
          onApplyDuration={applyDuration}
          onSetPhase={setPhase}
          onSetRemaining={setRemaining}
        />
        <FocusTodosPanel
          todos={todos}
          visibleTodos={visibleTodos}
          todoFilter={todoFilter}
          draftTodo={draftTodo}
          draggedTodoId={draggedTodoId}
          dropIndicator={dropIndicator}
          onTodoFilterChange={setTodoFilter}
          onDraftChange={setDraftTodo}
          onSubmitTodo={submitTodo}
          onToggleTodo={(todoId) =>
            persistTodos(toggleFocusTodo(todos, todoId))
          }
          onDeleteTodo={(todoId) =>
            persistTodos(removeFocusTodo(todos, todoId), [todoId])
          }
          onDragStart={handleTodoDragStart}
          onDragOver={handleTodoDragOver}
          onDrop={handleTodoDrop}
          onDragEnd={clearDragState}
          onClearDropIndicator={(todoId) => {
            if (dropIndicator?.id === todoId) {
              setDropIndicator(null);
            }
          }}
        />
      </div>
    );
  }

  return (
    <DashboardWidgetShell
      variant="glass"
      title={paneTitle}
      description={paneDescription}
      headerActions={paneSwitcher}
      contentClassName={
        pane === 'music' && musicMaximized ? 'px-0 pb-0' : 'pb-1'
      }
    >
      {foregroundPane}
      {musicKeepAlive || musicVisible ? (
        <div
          className={musicShelfClassName}
          aria-hidden={!musicVisible}
          inert={!musicVisible ? true : undefined}
        >
          <MusicWidget
            userId={userId}
            embedded
            active={musicVisible}
            onPlayerMaximizedChange={setMusicMaximized}
          />
        </div>
      ) : null}
    </DashboardWidgetShell>
  );
}

function WipListWidget({
  bootstrap,
}: Readonly<{ bootstrap: ProductivityDashboardBootstrap }>) {
  const meta = widgetById['my-work-wip'];

  return (
    <DashboardWidgetShell
      title={meta.title}
      description={meta.description}
      headerActions={
        <AssignedCompletionPill percent={bootstrap.completion.percent} />
      }
    >
      {bootstrap.wipItems.length > 0 ? (
        <HomeWipList items={bootstrap.wipItems} />
      ) : (
        <p className="text-muted-foreground text-sm">
          No open assigned work items right now.
        </p>
      )}
    </DashboardWidgetShell>
  );
}

function NotificationsListWidget({
  bootstrap,
}: Readonly<{ bootstrap: ProductivityDashboardBootstrap }>) {
  const meta = widgetById.notifications;

  return (
    <DashboardWidgetShell title={meta.title} description={meta.description}>
      {bootstrap.unreadNotifications.length > 0 ? (
        <HomeNotificationList notifications={bootstrap.unreadNotifications} />
      ) : (
        <p className="text-muted-foreground text-sm">
          You&apos;re all caught up — no unread notifications.
        </p>
      )}
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
    case 'my-work-categories':
      return (
        <MyWorkCategoriesWidget userId={userId} stats={bootstrap.myWork} />
      );
    case 'my-work-wip':
      return <WipListWidget bootstrap={bootstrap} />;
    case 'notifications':
      return <NotificationsListWidget bootstrap={bootstrap} />;
    case 'projects':
      return <ProjectsWidget projects={bootstrap.projects} />;
    case 'alice':
      return (
        <AliceWidget
          userId={userId}
          chatModels={bootstrap.chatModels}
          chatAgents={bootstrap.chatAgents}
          preferredChatAgentId={bootstrap.preferredChatAgentId}
        />
      );
    case 'docs':
      return <DocsWidget docs={bootstrap.docs} />;
    case 'pomodoro':
      return <PomodoroWidget userId={userId} />;
    default:
      return null;
  }
}
