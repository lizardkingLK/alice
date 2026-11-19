/**
 * Browser Notification helpers for Focus timer completion.
 * Safe no-ops when Notification API is unavailable or permission is denied.
 */

export const POMODORO_COMPLETE_TITLE = 'Focus timer finished';
export const POMODORO_COMPLETE_BODY =
  'Your focus session is done. Take a break or start another.';

export function canUseBrowserNotifications(): boolean {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined';
}

/** Ask for permission once (e.g. when the user starts a session). */
export async function ensurePomodoroNotifyPermission(): Promise<
  NotificationPermission | 'unsupported'
> {
  if (!canUseBrowserNotifications()) {
    return 'unsupported';
  }
  if (Notification.permission !== 'default') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Show a system notification when a focus session completes.
 * Returns false when the API is missing or permission is not granted.
 */
export function notifyPomodoroComplete(): boolean {
  if (!canUseBrowserNotifications()) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }
  try {
    const notification = new Notification(POMODORO_COMPLETE_TITLE, {
      body: POMODORO_COMPLETE_BODY,
      tag: 'alice-pomodoro-complete',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}
