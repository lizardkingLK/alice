import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';

const STORAGE_PREFIX = 'alice:overview-pomodoro:v1:';

export const POMODORO_MIN_MINUTES = 5;
export const POMODORO_MAX_MINUTES = 60;
export const POMODORO_DEFAULT_MINUTES = 25;
export const POMODORO_STEP_MINUTES = 5;
/** Persist remaining time while a session is running. */
export const POMODORO_PERSIST_INTERVAL_MS = 10_000;

export type PomodoroPhase = 'idle' | 'running' | 'paused';

export type PomodoroPreference = {
  readonly durationMinutes: number;
};

/** Full timer snapshot persisted in localStorage. */
export type PomodoroStoredState = {
  readonly durationMinutes: number;
  readonly phase: PomodoroPhase;
  /** Remaining seconds as of `savedAtMs`. */
  readonly remainingSeconds: number;
  /** Epoch ms when `remainingSeconds` was last written. */
  readonly savedAtMs: number;
};

export type PomodoroHydratedState = {
  readonly durationMinutes: number;
  readonly phase: PomodoroPhase;
  readonly remainingSeconds: number;
};

/** Primary control label for the Start / Pause / Resume button. */
export function pomodoroPrimaryActionLabel(phase: PomodoroPhase): string {
  if (phase === 'running') {
    return 'Pause';
  }
  if (phase === 'paused') {
    return 'Resume';
  }
  return 'Start';
}

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

function defaultStoredState(nowMs = Date.now()): PomodoroStoredState {
  const durationMinutes = POMODORO_DEFAULT_MINUTES;
  return {
    durationMinutes,
    phase: 'idle',
    remainingSeconds: durationMinutes * 60,
    savedAtMs: nowMs,
  };
}

function parsePhase(value: unknown): PomodoroPhase | null {
  if (value === 'idle' || value === 'running' || value === 'paused') {
    return value;
  }
  return null;
}

/**
 * Catch up a stored snapshot to `nowMs`.
 * Running sessions subtract elapsed wall time; paused/idle keep remaining.
 */
export function hydratePomodoroState(
  stored: PomodoroStoredState,
  nowMs: number = Date.now()
): PomodoroHydratedState {
  const durationMinutes = clampPomodoroMinutes(stored.durationMinutes);
  const durationSeconds = durationMinutes * 60;
  const remainingCap = Math.min(
    durationSeconds,
    Math.max(0, Math.floor(stored.remainingSeconds))
  );

  if (stored.phase !== 'running') {
    return {
      durationMinutes,
      phase: stored.phase === 'paused' ? 'paused' : 'idle',
      remainingSeconds: remainingCap,
    };
  }

  const savedAt =
    typeof stored.savedAtMs === 'number' && Number.isFinite(stored.savedAtMs)
      ? stored.savedAtMs
      : nowMs;
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - savedAt) / 1000));
  const remainingSeconds = Math.max(0, remainingCap - elapsedSeconds);

  if (remainingSeconds === 0) {
    return {
      durationMinutes,
      phase: 'idle',
      remainingSeconds: 0,
    };
  }

  return {
    durationMinutes,
    phase: 'running',
    remainingSeconds,
  };
}

export function readPomodoroStoredState(
  userId: string | null | undefined,
  nowMs: number = Date.now()
): PomodoroStoredState {
  if (!userId) {
    return defaultStoredState(nowMs);
  }
  const raw = getLocalStorageJson(storageKey(userId));
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaultStoredState(nowMs);
  }
  const row = raw as Record<string, unknown>;
  const minutes =
    typeof row.durationMinutes === 'number' &&
    Number.isFinite(row.durationMinutes)
      ? clampPomodoroMinutes(row.durationMinutes)
      : POMODORO_DEFAULT_MINUTES;

  const phase = parsePhase(row.phase);
  if (!phase) {
    // Legacy preference: duration only → idle at full duration.
    return {
      durationMinutes: minutes,
      phase: 'idle',
      remainingSeconds: minutes * 60,
      savedAtMs: nowMs,
    };
  }

  const remainingSeconds =
    typeof row.remainingSeconds === 'number' &&
    Number.isFinite(row.remainingSeconds)
      ? Math.max(0, Math.floor(row.remainingSeconds))
      : minutes * 60;
  const savedAtMs =
    typeof row.savedAtMs === 'number' && Number.isFinite(row.savedAtMs)
      ? row.savedAtMs
      : nowMs;

  return {
    durationMinutes: minutes,
    phase,
    remainingSeconds,
    savedAtMs,
  };
}

export function writePomodoroStoredState(
  userId: string | null | undefined,
  state: PomodoroStoredState
): void {
  if (!userId) {
    return;
  }
  const durationMinutes = clampPomodoroMinutes(state.durationMinutes);
  setLocalStorageJson(storageKey(userId), {
    durationMinutes,
    phase: state.phase,
    remainingSeconds: Math.max(0, Math.floor(state.remainingSeconds)),
    savedAtMs: state.savedAtMs,
  });
}

/** @deprecated Prefer readPomodoroStoredState + hydratePomodoroState. */
export function readPomodoroPreference(
  userId: string | null | undefined
): PomodoroPreference {
  return {
    durationMinutes: readPomodoroStoredState(userId).durationMinutes,
  };
}

/** Duration-only write — preserves running/paused session fields when possible. */
export function writePomodoroPreference(
  userId: string | null | undefined,
  preference: PomodoroPreference
): void {
  if (!userId) {
    return;
  }
  const durationMinutes = clampPomodoroMinutes(preference.durationMinutes);
  const existing = readPomodoroStoredState(userId);
  writePomodoroStoredState(userId, {
    ...existing,
    durationMinutes,
    phase: 'idle',
    remainingSeconds: durationMinutes * 60,
    savedAtMs: Date.now(),
  });
}
