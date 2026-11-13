/**
 * Document Picture-in-Picture session for the Overview Focus music player.
 * Module singleton so the floating window survives DashboardShell remounts
 * when navigating between Alice routes.
 */

import type { MusicProviderId } from '@/app/dashboard/_helpers/music-playlist-storage';

export type MusicPipSession = {
  readonly provider: MusicProviderId;
  readonly label: string;
  readonly playlistUrl: string;
  readonly embedUrl: string;
};

type DocumentPictureInPictureWindowOptions = {
  readonly width?: number;
  readonly height?: number;
};

type DocumentPictureInPicture = {
  requestWindow: (
    // eslint-disable-next-line no-unused-vars -- DOM API callback param
    options?: DocumentPictureInPictureWindowOptions
  ) => Promise<Window>;
  readonly window: Window | null;
};

type PipCapableWindow = Window & {
  readonly documentPictureInPicture?: DocumentPictureInPicture;
};

const PIP_WIDTH = 380;
const PIP_HEIGHT = 640;

let activeSession: MusicPipSession | null = null;
let pipWindow: Window | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

function setSession(next: MusicPipSession | null): void {
  activeSession = next;
  notify();
}

export function isDocumentPipSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean((window as PipCapableWindow).documentPictureInPicture);
}

export function getMusicPipSession(): MusicPipSession | null {
  return activeSession;
}

export function subscribeMusicPip(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function renderPipShell(
  target: Document,
  session: MusicPipSession
): HTMLDivElement {
  const html = target.documentElement;
  html.style.height = '100%';
  html.style.margin = '0';

  target.body.replaceChildren();
  target.body.style.margin = '0';
  target.body.style.height = '100%';
  target.body.style.display = 'flex';
  target.body.style.flexDirection = 'column';
  target.body.style.overflow = 'hidden';
  target.body.style.background = '#121212';
  target.body.style.color = '#fafafa';
  target.body.style.fontFamily = 'system-ui, sans-serif';

  const root = target.createElement('div');
  root.setAttribute('data-testid', 'music-pip-player');
  root.setAttribute('aria-label', `${session.label} picture-in-picture player`);
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.flex = '1';
  root.style.minHeight = '0';
  root.style.width = '100%';
  root.style.overflow = 'hidden';

  const header = target.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.gap = '0.5rem';
  header.style.flexShrink = '0';
  header.style.padding = '0.5rem 0.75rem';
  header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.12)';

  const title = target.createElement('div');
  title.textContent = session.label;
  title.style.flex = '1';
  title.style.minWidth = '0';
  title.style.overflow = 'hidden';
  title.style.textOverflow = 'ellipsis';
  title.style.whiteSpace = 'nowrap';
  title.style.fontSize = '0.75rem';
  title.style.fontWeight = '600';

  const openLink = target.createElement('a');
  openLink.href = session.playlistUrl;
  openLink.target = '_blank';
  openLink.rel = 'noopener noreferrer';
  openLink.textContent = 'Open';
  openLink.setAttribute('aria-label', `Open ${session.label} playlist`);
  openLink.style.fontSize = '0.75rem';
  openLink.style.color = 'inherit';
  openLink.style.opacity = '0.8';
  openLink.style.textDecoration = 'none';

  const closeButton = target.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.setAttribute('aria-label', 'Dock player');
  closeButton.style.fontSize = '0.75rem';
  closeButton.style.cursor = 'pointer';
  closeButton.style.border = '0';
  closeButton.style.background = 'transparent';
  closeButton.style.color = 'inherit';
  closeButton.style.opacity = '0.8';
  closeButton.addEventListener('click', () => {
    closeMusicDocumentPip();
  });

  header.append(title, openLink, closeButton);

  const stage = target.createElement('div');
  stage.style.flex = '1 1 auto';
  stage.style.width = '100%';
  stage.style.minHeight = '0';
  stage.style.background = '#121212';

  root.append(header, stage);
  target.body.append(root);
  return stage;
}

function mountPlainEmbed(
  stage: HTMLDivElement,
  session: MusicPipSession
): void {
  const frame = stage.ownerDocument.createElement('iframe');
  frame.title = `${session.label} playlist`;
  frame.src = session.embedUrl;
  frame.allow =
    'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.border = '0';
  frame.style.background = '#121212';
  stage.append(frame);
}

function renderPipChrome(target: Document, session: MusicPipSession): void {
  const stage = renderPipShell(target, session);
  mountPlainEmbed(stage, session);
}

function detachPipWindow(): void {
  if (pipWindow) {
    pipWindow.removeEventListener('pagehide', onPipPageHide);
    if (!pipWindow.closed) {
      pipWindow.close();
    }
  }
  pipWindow = null;
}

function onPipPageHide(): void {
  pipWindow = null;
  setSession(null);
}

export async function openMusicDocumentPip(
  session: MusicPipSession
): Promise<boolean> {
  const dpi = (window as PipCapableWindow).documentPictureInPicture;
  if (!dpi) {
    return false;
  }

  detachPipWindow();

  const nextWindow = await dpi.requestWindow({
    width: PIP_WIDTH,
    height: PIP_HEIGHT,
  });
  pipWindow = nextWindow;
  renderPipChrome(nextWindow.document, session);
  nextWindow.addEventListener('pagehide', onPipPageHide);
  setSession(session);
  return true;
}

export function closeMusicDocumentPip(): void {
  detachPipWindow();
  setSession(null);
}
