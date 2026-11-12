import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('music-document-pip', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reports unsupported when Document PiP is missing', async () => {
    vi.stubGlobal('window', {});
    const { isDocumentPipSupported, getMusicPipSession } =
      await import('@/app/dashboard/_helpers/music-document-pip');
    expect(isDocumentPipSupported()).toBe(false);
    expect(getMusicPipSession()).toBeNull();
  });

  it('opens a Document PiP window and tracks the session', async () => {
    const pipDocument = document.implementation.createHTMLDocument('pip');
    const close = vi.fn();
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    const pipWindow = {
      document: pipDocument,
      closed: false,
      close,
      addEventListener,
      removeEventListener,
    };

    const requestWindow = vi.fn().mockResolvedValue(pipWindow);
    vi.stubGlobal('window', {
      documentPictureInPicture: { requestWindow },
    });
    vi.stubGlobal('document', document);

    const {
      closeMusicDocumentPip,
      getMusicPipSession,
      isDocumentPipSupported,
      openMusicDocumentPip,
      subscribeMusicPip,
    } = await import('@/app/dashboard/_helpers/music-document-pip');

    expect(isDocumentPipSupported()).toBe(true);

    const listener = vi.fn();
    const unsubscribe = subscribeMusicPip(listener);

    const opened = await openMusicDocumentPip({
      provider: 'spotify',
      label: 'Spotify',
      playlistUrl: 'https://open.spotify.com/playlist/demo',
      embedUrl: 'about:blank#spotify-embed',
    });

    expect(opened).toBe(true);
    expect(requestWindow).toHaveBeenCalled();
    expect(getMusicPipSession()?.provider).toBe('spotify');
    expect(listener).toHaveBeenCalled();
    expect(
      pipDocument.querySelector('[data-testid="music-pip-player"]')
    ).not.toBeNull();
    expect(pipDocument.querySelector('iframe')?.src).toContain(
      'about:blank#spotify-embed'
    );

    closeMusicDocumentPip();
    expect(close).toHaveBeenCalled();
    expect(getMusicPipSession()).toBeNull();
    unsubscribe();
  });
});
