import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DATABASE_BUSY_CODE,
  DATABASE_BUSY_HTTP_STATUS,
  DATABASE_BUSY_USER_MESSAGE,
} from '@repo/types';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  isDatabaseBusyApiError,
  withApiBusyRetry,
} from '@/lib/api/api-fetch.with-busy-retry';

describe('withApiBusyRetry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects ApiError with DATABASE_BUSY code', () => {
    expect(
      isDatabaseBusyApiError(
        new ApiError(DATABASE_BUSY_USER_MESSAGE, DATABASE_BUSY_HTTP_STATUS, {
          code: DATABASE_BUSY_CODE,
        })
      )
    ).toBe(true);
  });

  it('retries busy failures then returns', async () => {
    // Arrange
    const onRetry = vi.fn();
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(DATABASE_BUSY_USER_MESSAGE, DATABASE_BUSY_HTTP_STATUS, {
          code: DATABASE_BUSY_CODE,
        })
      )
      .mockResolvedValueOnce({ ok: true });

    // Act
    await expect(
      withApiBusyRetry(operation, { baseDelayMs: 1, onRetry })
    ).resolves.toEqual({ ok: true });

    // Assert
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1);
  });

  it('stops after max retries', async () => {
    // Arrange
    const busy = new ApiError(
      DATABASE_BUSY_USER_MESSAGE,
      DATABASE_BUSY_HTTP_STATUS,
      { code: DATABASE_BUSY_CODE }
    );
    const operation = vi.fn().mockRejectedValue(busy);

    // Act + Assert
    await expect(
      withApiBusyRetry(operation, { maxRetries: 1, baseDelayMs: 1 })
    ).rejects.toBe(busy);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
