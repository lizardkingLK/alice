'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  ExternalLink,
  Maximize2,
  Minimize2,
  Music2,
  PictureInPicture2,
  Trash2,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import { DashboardWidgetShell } from '@/app/dashboard/_components/dashboard-widget-shell';
import { useMusicPipOptional } from '@/app/dashboard/_components/productivity/music-pip-launcher';
import {
  isPlaylistUrl,
  musicPlaylistEmbedUrl,
  musicProviderMeta,
  MUSIC_PROVIDER_CATALOG,
  readMusicPlaylistPreferences,
  setMusicPlaylistUrl,
  setSelectedMusicProvider,
  writeMusicPlaylistPreferences,
  type MusicPlaylistPreferences,
  type MusicProviderId,
  type MusicProviderMeta,
} from '@/app/dashboard/_helpers/music-playlist-storage';

const MUSIC_TITLE = 'Music';
const MUSIC_DESCRIPTION = 'Focus playlists from your music apps';

type MusicWidgetProps = {
  readonly userId: string;
  /** When true, render pane body only (inside Focus). */
  readonly embedded?: boolean;
  /** False while shelved off-screen so maximize chrome resets. */
  readonly active?: boolean;
  // eslint-disable-next-line no-unused-vars -- maximize callback
  readonly onPlayerMaximizedChange?: (maximized: boolean) => void;
};

function MusicProviderTabs({
  provider,
  onSelect,
}: Readonly<{
  provider: MusicProviderId;
  // eslint-disable-next-line no-unused-vars -- provider callback
  onSelect: (provider: MusicProviderId) => void;
}>) {
  return (
    <Tabs
      value={provider}
      onValueChange={(value) => onSelect(value as MusicProviderId)}
      className="w-full"
    >
      <TabsList
        aria-label="Music providers"
        className="border-border flex h-auto w-full justify-start gap-3 overflow-x-auto rounded-none border-b bg-transparent p-0"
      >
        {MUSIC_PROVIDER_CATALOG.map((entry) => (
          <TabsTrigger
            key={entry.id}
            value={entry.id}
            className={cn(UNDERLINE_TAB_TRIGGER_CLASS, 'px-0 text-xs')}
          >
            {entry.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function MusicPlaylistUrlForm({
  draftUrl,
  placeholder,
  ariaLabel,
  canSave,
  onDraftChange,
  onSave,
}: Readonly<{
  draftUrl: string;
  placeholder: string;
  ariaLabel: string;
  canSave: boolean;
  // eslint-disable-next-line no-unused-vars -- draft callback
  onDraftChange: (value: string) => void;
  onSave: () => void;
}>) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSave();
  };

  return (
    <form className="flex shrink-0 gap-2" onSubmit={handleSubmit}>
      <Input
        value={draftUrl}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-9"
      />
      <Button
        type="submit"
        size="sm"
        className="h-9 shrink-0 cursor-pointer"
        disabled={!canSave}
      >
        Save
      </Button>
    </form>
  );
}

function MusicPlaylistToolbar({
  providerLabel,
  savedUrl,
  canMaximize,
  canPopOut,
  pipSupported,
  onMaximize,
  onPopOut,
  onClear,
}: Readonly<{
  providerLabel: string;
  savedUrl: string;
  canMaximize: boolean;
  canPopOut: boolean;
  pipSupported: boolean;
  onMaximize: () => void;
  onPopOut: () => void;
  onClear: () => void;
}>) {
  return (
    <div className="flex items-center justify-end gap-1">
      {canMaximize ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Maximize player"
              onClick={onMaximize}
            >
              <Maximize2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Maximize</TooltipContent>
        </Tooltip>
      ) : null}
      {pipSupported ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              aria-label="Pop out picture-in-picture player"
              disabled={!canPopOut}
              onClick={onPopOut}
            >
              <PictureInPicture2 className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Picture in picture</TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon-sm">
            <a
              href={savedUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${providerLabel} playlist`}
            >
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open playlist</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label={`Clear ${providerLabel} playlist`}
            onClick={onClear}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Clear</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Soft glass exit control — always visible while the player is maximized. */
function MusicMaximizedExitChrome({
  onMinimize,
}: Readonly<{
  onMinimize: () => void;
}>) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-11 items-start justify-center pt-2.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn(
          'border-border/50 bg-background/35 text-foreground size-8 cursor-pointer rounded-full border opacity-55',
          'shadow-[inset_0_1px_0_color-mix(in_oklch,white_45%,transparent),0_4px_16px_color-mix(in_oklch,var(--foreground)_12%,transparent)]',
          'backdrop-blur-md backdrop-saturate-150',
          'hover:bg-background/55 pointer-events-auto hover:opacity-100'
        )}
        aria-label="Minimize player"
        title="Minimize player"
        onClick={onMinimize}
      >
        <Minimize2 className="size-3.5" />
      </Button>
    </div>
  );
}

function MusicEmbedPlayer({
  providerMeta,
  embedUrl,
  playerMaximized,
  onMinimize,
}: Readonly<{
  providerMeta: MusicProviderMeta;
  embedUrl: string;
  playerMaximized: boolean;
  onMinimize: () => void;
}>) {
  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col overflow-hidden',
        playerMaximized ? 'rounded-none' : 'rounded-md'
      )}
    >
      {playerMaximized ? (
        <MusicMaximizedExitChrome onMinimize={onMinimize} />
      ) : null}
      <iframe
        title={`${providerMeta.label} playlist`}
        src={embedUrl}
        className={cn(
          'bg-background min-h-0 w-full flex-1 border-0',
          playerMaximized ? 'h-full rounded-none' : 'min-h-40 rounded-md'
        )}
        loading="lazy"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
      />
    </div>
  );
}

function MusicEmptyState({ message }: Readonly<{ message: string }>) {
  return (
    <div className="bg-muted/20 text-muted-foreground flex min-h-32 flex-1 flex-col items-center justify-center gap-2 rounded-md px-3 text-center text-xs">
      <Music2 className="size-5 opacity-70" aria-hidden />
      <p>{message}</p>
    </div>
  );
}

function MusicPipPlaceholder({
  label,
  onDock,
}: Readonly<{
  label: string;
  onDock: () => void;
}>) {
  return (
    <div className="bg-muted/20 flex min-h-32 flex-1 flex-col items-center justify-center gap-3 rounded-md px-3 text-center">
      <PictureInPicture2
        className="text-muted-foreground size-5 opacity-70"
        aria-hidden
      />
      <p className="text-muted-foreground text-xs">
        {label} is playing in picture-in-picture.
      </p>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="cursor-pointer"
        onClick={onDock}
      >
        Dock player
      </Button>
    </div>
  );
}

function MusicSavedPlaylistBody({
  savedUrl,
  embedUrl,
  providerMeta,
  playerMaximized,
  pipActiveForProvider,
  canMaximize,
  canPopOut,
  pipSupported,
  onDock,
  onMaximize,
  onMinimize,
  onPopOut,
  onClear,
}: Readonly<{
  savedUrl: string;
  embedUrl: string | null;
  providerMeta: MusicProviderMeta;
  playerMaximized: boolean;
  pipActiveForProvider: boolean;
  canMaximize: boolean;
  canPopOut: boolean;
  pipSupported: boolean;
  onDock: () => void;
  onMaximize: () => void;
  onMinimize: () => void;
  onPopOut: () => void;
  onClear: () => void;
}>): ReactNode {
  if (!savedUrl) {
    return (
      <MusicEmptyState
        message={`Paste a ${providerMeta.label} playlist link to keep it on Overview.`}
      />
    );
  }

  let playerArea: ReactNode;
  if (pipActiveForProvider) {
    playerArea = (
      <MusicPipPlaceholder label={providerMeta.label} onDock={onDock} />
    );
  } else if (embedUrl) {
    playerArea = (
      <MusicEmbedPlayer
        providerMeta={providerMeta}
        embedUrl={embedUrl}
        playerMaximized={playerMaximized}
        onMinimize={onMinimize}
      />
    );
  } else {
    playerArea = (
      <MusicEmptyState
        message={`Playlist saved. Open it in ${providerMeta.label} to listen.`}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        !playerMaximized && 'gap-2'
      )}
    >
      {!playerMaximized ? (
        <MusicPlaylistToolbar
          providerLabel={providerMeta.label}
          savedUrl={savedUrl}
          canMaximize={canMaximize && !pipActiveForProvider}
          canPopOut={canPopOut}
          pipSupported={pipSupported}
          onMaximize={onMaximize}
          onPopOut={onPopOut}
          onClear={onClear}
        />
      ) : null}
      {playerArea}
    </div>
  );
}

export function MusicWidget({
  userId,
  embedded = false,
  active = true,
  onPlayerMaximizedChange,
}: Readonly<MusicWidgetProps>) {
  const musicPip = useMusicPipOptional();
  const [prefs, setPrefs] = useState<MusicPlaylistPreferences>(() =>
    readMusicPlaylistPreferences(userId)
  );
  const [draftUrl, setDraftUrl] = useState(() => {
    const initial = readMusicPlaylistPreferences(userId);
    return initial.urls[initial.selectedProvider] ?? '';
  });
  const [playerMaximized, setPlayerMaximized] = useState(false);

  useEffect(() => {
    const next = readMusicPlaylistPreferences(userId);
    setPrefs(next);
    setDraftUrl(next.urls[next.selectedProvider] ?? '');
    setPlayerMaximized(false);
    onPlayerMaximizedChange?.(false);
  }, [userId, onPlayerMaximizedChange]);

  useEffect(() => {
    if (active) {
      return;
    }
    setPlayerMaximized(false);
    onPlayerMaximizedChange?.(false);
  }, [active, onPlayerMaximizedChange]);

  useEffect(() => {
    if (!playerMaximized) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPlayerMaximized(false);
        onPlayerMaximizedChange?.(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [playerMaximized, onPlayerMaximizedChange]);

  useEffect(() => {
    return () => {
      onPlayerMaximizedChange?.(false);
    };
  }, [onPlayerMaximizedChange]);

  const setMaximized = (next: boolean) => {
    setPlayerMaximized(next);
    onPlayerMaximizedChange?.(next);
  };

  const provider = prefs.selectedProvider;
  const providerMeta = musicProviderMeta(provider);
  const savedUrl = prefs.urls[provider] ?? '';
  const embedUrl = savedUrl ? musicPlaylistEmbedUrl(provider, savedUrl) : null;
  const draftValid = isPlaylistUrl(draftUrl);
  const canSave = draftValid && draftUrl.trim() !== savedUrl;
  const canMaximize = Boolean(embedUrl);
  const pipActiveForProvider =
    musicPip.session?.provider === provider &&
    musicPip.session.playlistUrl === savedUrl;
  const canPopOut = Boolean(
    embedUrl && musicPip.supported && !pipActiveForProvider
  );

  const persist = (next: MusicPlaylistPreferences) => {
    setPrefs(next);
    writeMusicPlaylistPreferences(userId, next);
  };

  const selectProvider = (nextProvider: MusicProviderId) => {
    const next = setSelectedMusicProvider(prefs, nextProvider);
    persist(next);
    setDraftUrl(next.urls[nextProvider] ?? '');
    setMaximized(false);
  };

  const saveUrl = () => {
    if (!canSave) {
      return;
    }
    const next = setMusicPlaylistUrl(prefs, provider, draftUrl);
    persist(next);
    setDraftUrl(next.urls[provider] ?? '');
  };

  const clearUrl = () => {
    if (
      musicPip.session &&
      musicPip.session.provider === provider &&
      musicPip.session.playlistUrl === savedUrl
    ) {
      musicPip.dock();
    }
    const next = setMusicPlaylistUrl(prefs, provider, '');
    persist(next);
    setDraftUrl('');
    setMaximized(false);
  };

  const popOutPlayer = () => {
    if (!embedUrl || !savedUrl || !musicPip.supported) {
      return;
    }
    setMaximized(false);
    musicPip
      .popOut({
        provider,
        label: providerMeta.label,
        playlistUrl: savedUrl,
        embedUrl,
      })
      .catch(() => {
        // Document PiP can fail if the browser denies the window request.
      });
  };

  const playlistBody = (
    <MusicSavedPlaylistBody
      savedUrl={savedUrl}
      embedUrl={embedUrl}
      providerMeta={providerMeta}
      playerMaximized={playerMaximized}
      pipActiveForProvider={pipActiveForProvider}
      canMaximize={canMaximize}
      canPopOut={canPopOut}
      pipSupported={musicPip.supported}
      onDock={() => musicPip.dock()}
      onMaximize={() => setMaximized(true)}
      onMinimize={() => setMaximized(false)}
      onPopOut={popOutPlayer}
      onClear={clearUrl}
    />
  );

  const body = (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col',
        !playerMaximized && 'gap-3'
      )}
    >
      {!playerMaximized ? (
        <>
          <MusicProviderTabs provider={provider} onSelect={selectProvider} />
          <MusicPlaylistUrlForm
            draftUrl={draftUrl}
            placeholder={providerMeta.placeholder}
            ariaLabel={`${providerMeta.label} playlist URL`}
            canSave={canSave}
            onDraftChange={setDraftUrl}
            onSave={saveUrl}
          />
        </>
      ) : null}
      {playlistBody}
    </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <DashboardWidgetShell
      variant="glass"
      title={MUSIC_TITLE}
      description={MUSIC_DESCRIPTION}
      contentClassName={playerMaximized ? 'px-0 pb-0' : 'pb-2'}
    >
      {body}
    </DashboardWidgetShell>
  );
}
