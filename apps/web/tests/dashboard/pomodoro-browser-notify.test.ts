import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  canUseBrowserNotifications,
  ensurePomodoroNotifyPermission,
  notifyPomodoroComplete,
  POMODORO_COMPLETE_BODY,
  POMODORO_COMPLETE_TITLE,
} from '@/app/dashboard/_helpers/pomodoro-browser-notify';

describe('pomodoro browser notify', () => {
  const originalNotification = globalThis.Notification;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalNotification) {
      Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        value: originalNotification,
      });
    }
  });

  it('reports unsupported when Notification is missing', () => {
    vi.stubGlobal('Notification', undefined);
    expect(canUseBrowserNotifications()).toBe(false);
    expect(notifyPomodoroComplete()).toBe(false);
  });

  it('requests permission only when still default', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    class FakeNotificationDefault {
      static readonly permission: NotificationPermission = 'default';
      static readonly requestPermission = requestPermission;
    }
    vi.stubGlobal('Notification', FakeNotificationDefault);

    await expect(ensurePomodoroNotifyPermission()).resolves.toBe('granted');
    expect(requestPermission).toHaveBeenCalledTimes(1);

    class FakeNotificationDenied {
      static readonly permission: NotificationPermission = 'denied';
      static readonly requestPermission = requestPermission;
    }
    vi.stubGlobal('Notification', FakeNotificationDenied);
    await expect(ensurePomodoroNotifyPermission()).resolves.toBe('denied');
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('shows a tagged notification when permission is granted', () => {
    const instances: Array<{
      title: string;
      options?: NotificationOptions;
      // eslint-disable-next-line no-unused-vars
      onclick: ((this: Notification, ev: Event) => unknown) | null;
      close: ReturnType<typeof vi.fn>;
    }> = [];

    class FakeNotification {
      static readonly permission: NotificationPermission = 'granted';
      static readonly requestPermission = vi.fn();
      // eslint-disable-next-line no-unused-vars
      onclick: ((this: Notification, ev: Event) => unknown) | null = null;
      close = vi.fn();

      constructor(
        // eslint-disable-next-line no-unused-vars
        public title: string,
        // eslint-disable-next-line no-unused-vars
        public options?: NotificationOptions
      ) {
        instances.push(this);
      }
    }

    vi.stubGlobal('Notification', FakeNotification);
    const focus = vi.fn();
    vi.stubGlobal('window', { ...window, focus });

    expect(notifyPomodoroComplete()).toBe(true);
    expect(instances).toHaveLength(1);
    expect(instances[0]?.title).toBe(POMODORO_COMPLETE_TITLE);
    expect(instances[0]?.options).toMatchObject({
      body: POMODORO_COMPLETE_BODY,
      tag: 'alice-pomodoro-complete',
    });

    instances[0]?.onclick?.call(
      instances[0] as unknown as Notification,
      {
        type: 'click',
      } as Event
    );
    expect(focus).toHaveBeenCalled();
    expect(instances[0]?.close).toHaveBeenCalled();
  });

  it('skips when permission is denied', () => {
    class FakeNotification {
      static readonly permission: NotificationPermission = 'denied';
      constructor() {
        throw new Error('should not construct');
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    expect(notifyPomodoroComplete()).toBe(false);
  });
});
