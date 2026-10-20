import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageJson: (key: string) => {
    const raw = store.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  },
  setLocalStorageJson: (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
    return true;
  },
}));

import {
  hydratePomodoroState,
  pomodoroPrimaryActionLabel,
  readPomodoroStoredState,
  writePomodoroStoredState,
} from '@/app/dashboard/_helpers/pomodoro-preference';

describe('pomodoro session persistence', () => {
  beforeEach(() => {
    store.clear();
  });

  it('hydrates a running session by subtracting elapsed wall time', () => {
    const savedAtMs = 1_000_000;
    const hydrated = hydratePomodoroState(
      {
        durationMinutes: 25,
        phase: 'running',
        remainingSeconds: 600,
        savedAtMs,
      },
      savedAtMs + 45_000
    );
    expect(hydrated).toEqual({
      durationMinutes: 25,
      phase: 'running',
      remainingSeconds: 555,
    });
  });

  it('marks a running session idle when elapsed exhausts remaining', () => {
    const savedAtMs = 1_000_000;
    const hydrated = hydratePomodoroState(
      {
        durationMinutes: 25,
        phase: 'running',
        remainingSeconds: 30,
        savedAtMs,
      },
      savedAtMs + 60_000
    );
    expect(hydrated).toEqual({
      durationMinutes: 25,
      phase: 'idle',
      remainingSeconds: 0,
    });
  });

  it('does not advance remaining while paused', () => {
    const savedAtMs = 1_000_000;
    const hydrated = hydratePomodoroState(
      {
        durationMinutes: 25,
        phase: 'paused',
        remainingSeconds: 400,
        savedAtMs,
      },
      savedAtMs + 120_000
    );
    expect(hydrated).toEqual({
      durationMinutes: 25,
      phase: 'paused',
      remainingSeconds: 400,
    });
  });

  it('reads legacy duration-only preference as idle at full duration', () => {
    store.set(
      'alice:overview-pomodoro:v1:user-1',
      JSON.stringify({ durationMinutes: 30 })
    );
    const now = 5_000_000;
    const stored = readPomodoroStoredState('user-1', now);
    expect(stored).toEqual({
      durationMinutes: 30,
      phase: 'idle',
      remainingSeconds: 1800,
      savedAtMs: now,
    });
  });

  it('round-trips a paused snapshot', () => {
    writePomodoroStoredState('user-1', {
      durationMinutes: 20,
      phase: 'paused',
      remainingSeconds: 900,
      savedAtMs: 42,
    });
    expect(readPomodoroStoredState('user-1', 99)).toEqual({
      durationMinutes: 20,
      phase: 'paused',
      remainingSeconds: 900,
      savedAtMs: 42,
    });
  });

  it('labels the primary action from phase', () => {
    expect(pomodoroPrimaryActionLabel('running')).toBe('Pause');
    expect(pomodoroPrimaryActionLabel('paused')).toBe('Resume');
    expect(pomodoroPrimaryActionLabel('idle')).toBe('Start');
  });
});
