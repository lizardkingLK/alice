import { describe, expect, it, vi } from 'vitest';
import { DATABASE_BUSY_USER_MESSAGE, isDatabaseBusyMessage } from '@repo/types';
import { withBusyRetry } from '../src/with-busy-retry';

describe('isDatabaseBusyMessage', () => {
  it('detects Supabase session pool exhaustion', () => {
    expect(
      isDatabaseBusyMessage(
        '(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15'
      )
    ).toBe(true);
  });

  it('ignores unrelated database errors', () => {
    expect(isDatabaseBusyMessage('unique violation')).toBe(false);
  });
});

describe('withBusyRetry', () => {
  it('returns on first success', async () => {
    // Arrange
    const operation = vi.fn().mockResolvedValue('ok');

    // Act
    await expect(withBusyRetry(operation)).resolves.toBe('ok');

    // Assert
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on transaction start timeout then succeeds', async () => {
    // Arrange
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Transaction API error: Unable to start a transaction in the given time.'
        )
      )
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();

    // Act
    await expect(
      withBusyRetry(operation, { baseDelayMs: 1, onRetry })
    ).resolves.toBe('ok');

    // Assert
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('throws friendly busy message after exhausting retries', async () => {
    // Arrange
    const operation = vi
      .fn()
      .mockRejectedValue(
        new Error(
          'Transaction API error: Unable to start a transaction in the given time.'
        )
      );

    // Act + Assert
    await expect(
      withBusyRetry(operation, { maxAttempts: 2, baseDelayMs: 1 })
    ).rejects.toThrow(DATABASE_BUSY_USER_MESSAGE);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-busy errors', async () => {
    // Arrange
    const operation = vi.fn().mockRejectedValue(new Error('unique violation'));

    // Act + Assert
    await expect(withBusyRetry(operation, { baseDelayMs: 1 })).rejects.toThrow(
      'unique violation'
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('retries on EMAXCONNSESSION then succeeds', async () => {
    // Arrange
    const operation = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          "Database error. Code: 'XX000'. Message: '(EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15'"
        )
      )
      .mockResolvedValueOnce('ok');

    // Act
    await expect(withBusyRetry(operation, { baseDelayMs: 1 })).resolves.toBe(
      'ok'
    );

    // Assert
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
