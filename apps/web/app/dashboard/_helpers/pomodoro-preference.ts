import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const STORAGE_PREFIX = 'alice:overview-pomodoro:v1:';

export const POMODORO_MIN_MINUTES = 5;
export const POMODORO_MAX_MINUTES = 60;
export const POMODORO_DEFAULT_MINUTES = 25;
export const POMODORO_STEP_MINUTES = 5;

export type PomodoroPreference = {
  readonly durationMinutes: number;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function clampPomodoroMinutes(value: number): number {
  const stepped =
    Math.round(value / POMODORO_STEP_MINUTES) * POMODORO_STEP_MINUTES;
  return Math.min(
    POMODORO_MAX_MINUTES,
    Math.max(POMODORO_MIN_MINUTES, stepped)
  );
}

export function readPomodoroPreference(
  userId: string | null | undefined
): PomodoroPreference {
  if (!userId) {
    return { durationMinutes: POMODORO_DEFAULT_MINUTES };
  }
  const raw = getLocalStorageJson(storageKey(userId));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { durationMinutes: POMODORO_DEFAULT_MINUTES };
  }
  const minutes = (raw as { durationMinutes?: unknown }).durationMinutes;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) {
    return { durationMinutes: POMODORO_DEFAULT_MINUTES };
  }
  return { durationMinutes: clampPomodoroMinutes(minutes) };
}

export function writePomodoroPreference(
  userId: string | null | undefined,
  preference: PomodoroPreference
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(storageKey(userId), {
    durationMinutes: clampPomodoroMinutes(preference.durationMinutes),
  });
}
